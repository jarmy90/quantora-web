/**
 * QNT-0015 · Product plans & conversion preview tests.
 *
 *   bun run scripts/test-qnt-0015.ts
 *
 * Verifies the product offer presentation layer: exactly four mapped products,
 * all coming_soon, no active prices/plans/orders/payments/licenses/downloads,
 * the product route and invalid-product 404, the accessible mode selector, the
 * safe login return flow, and that strategy data, the Quantora Score and
 * auth remain untouched (no checkout, no Supabase calls, no financial claims).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCommercialCatalog } from '../src/commercial/catalog.ts';
import { publicStrategies } from '../src/catalog.ts';
import { buildProductOffer, resolveProductCta } from '../src/domain/commercial/productOffer.ts';
import { isBillingCombinationValid } from '../src/domain/commercial/plan.ts';
import { isSafeReturnTo } from '../src/domain/auth/contracts.ts';

const ROOT = resolve(import.meta.dir, '..');
const read = (p: string): string => readFileSync(resolve(ROOT, p), 'utf8');

const tests: { name: string; run: () => void }[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const detail = read('src/routes/strategies.$id.tsx');
const productRoute = read('src/routes/products.$productId.tsx');
const selector = read('src/components/AccessModeSelector.tsx');
const offerCard = read('src/components/ProductOfferCard.tsx');
const account = read('src/routes/account.tsx');
const i18n = read('src/i18n/index.ts');
const css = read('src/styles/app.css');

const KNOWN_PRODUCT_IDS = [
  'first-triangle-ustec-m30',
  'first-triangle-gold-m15',
  'stochextreme-ustec',
  'tm-bandas-s3-keeper',
];

const cat = buildCommercialCatalog();

test('exactly four mapped products exist in the commercial catalog', () => {
  assert(cat.length === 4, `expected 4 products, got ${cat.length}`);
  for (const id of KNOWN_PRODUCT_IDS) {
    assert(cat.some((p) => p.productId === id), `missing product ${id}`);
  }
});

test('StochExtreme Gold is not publicly listed', () => {
  assert(!cat.some((p) => p.productId.includes('stochextreme-gold') || p.displayName.includes('Gold ETH')), 'no stochextreme-gold product');
  assert(!publicStrategies.some((s) => s.id.includes('stochextreme-gold')), 'no stochextreme-gold strategy');
});

test('all four products remain coming_soon and none is available', () => {
  assert(cat.every((p) => p.productStatus === 'coming_soon'), 'all products coming_soon');
  assert(cat.every((p) => !p.availability.canStartCheckout && !p.availability.canDownload), 'checkout/download disabled');
});

test('offer view model carries no amount, currency, discount or checkout fields', () => {
  const strategy = publicStrategies.find((s) => s.id === 'first-triangle-adaptive')!;
  const offer = buildProductOffer(strategy)!;
  const json = JSON.stringify(offer).toLowerCase();
  assert(!json.includes('amount') && !json.includes('currency') && !json.includes('discount'), 'no monetary fields');
  assert(!json.includes('paymentprovider') && !json.includes('licensekey') && !json.includes('downloadurl') && !json.includes('vaultpath') && !json.includes('checkoutsession'), 'no commerce fields');
});

test('offer carries no private paths, source files or hashes', () => {
  const strategy = publicStrategies.find((s) => s.id === 'first-triangle-adaptive')!;
  const offer = buildProductOffer(strategy)!;
  const json = JSON.stringify(offer).toLowerCase();
  assert(!/(vault|sourcearchive|github|mq5|hash|credential|password|token|deliverypath)/.test(json), 'no private references');
});

test('no active plans, orders, payments, licenses or downloads', () => {
  // The economic catalog is empty: commercial rules always report not selectable.
  assert(cat.every((p) => p.availability.canStartCheckout === false), 'no selectable plan / checkout');
  assert(cat.every((p) => p.availability.canDownload === false), 'no downloads');
});

test('billing combination rules remain enforced (QNT-0012C)', () => {
  assert(isBillingCombinationValid({ billingModel: 'rental', billingInterval: 'monthly' }), 'rental monthly valid');
  assert(isBillingCombinationValid({ billingModel: 'rental', billingInterval: 'annual' }), 'rental annual valid');
  assert(!isBillingCombinationValid({ billingModel: 'rental', billingInterval: 'one_time' }), 'rental one_time invalid');
  assert(isBillingCombinationValid({ billingModel: 'purchase', billingInterval: 'one_time' }), 'purchase one_time valid');
  assert(!isBillingCombinationValid({ billingModel: 'purchase', billingInterval: 'monthly' }), 'purchase monthly invalid');
});

test('strategy detail renders the reusable product offer card', () => {
  assert(offerCard.includes("export function ProductOfferCard"), 'component exists');
  assert(detail.includes("<ProductOfferCard strategy={s} />"), 'detail uses ProductOfferCard');
  assert(offerCard.includes("buildProductOffer") && offerCard.includes("resolveProductCta"), 'derives from domain');
});

test('anonymous and authenticated CTA resolve correctly and safely', () => {
  const strategy = publicStrategies.find((s) => s.id === 'first-triangle-adaptive')!;
  const offer = buildProductOffer(strategy)!;
  const anon = resolveProductCta(offer, { isAuthenticated: false });
  const authd = resolveProductCta(offer, { isAuthenticated: true });
  assert(anon.ctaState === 'signIn', 'anonymous → sign in');
  assert(anon.ctaLabel === 'Sign in to continue', 'anonymous label');
  assert(authd.ctaState === 'seeOptions', 'authenticated → see options');
  assert(authd.ctaLabel === 'See options', 'authenticated label');
  assert(anon.returnTo === `/products/${offer.productId}` && isSafeReturnTo(anon.returnTo), 'returnTo internal');
  assert(authd.productPath === `/products/${offer.productId}`, 'product path');
});

test('external / malicious returnTo values are rejected', () => {
  assert(!isSafeReturnTo('https://evil.com'), 'external https rejected');
  assert(!isSafeReturnTo('//evil.com'), 'protocol-relative rejected');
  assert(!isSafeReturnTo('javascript:alert(1)'), 'javascript rejected');
  assert(isSafeReturnTo('/strategies/first-triangle-adaptive'), 'internal accepted');
  assert(isSafeReturnTo('/products/first-triangle-ustec-m30'), 'internal product accepted');
});

test('the product route exists and resolves only mapped products', () => {
  assert(productRoute.includes("createFileRoute('/products/$productId')"), 'route registered');
  assert(productRoute.includes('commercialCatalog') && productRoute.includes('buildProductOffer'), 'resolves from domain');
  assert(productRoute.includes('notFoundTitle') && productRoute.includes('notFoundBody'), 'safe 404 for invalid product');
});

test('mode selector shows monthly highlighted and the rest as coming soon', () => {
  assert(selector.includes('modes.monthly') && selector.includes('modes.quarterly') && selector.includes('modes.annual') && selector.includes('modes.purchase'), 'four modes');
  assert(selector.includes("state === 'coming_soon'"), 'coming-soon state handles others');
  assert(selector.includes('offer.availableSoon') || selector.includes('Available soon') || i18n.includes('offer.availableSoon'), 'no fake price');
});

test('selecting a mode never creates an order and never calls Supabase', () => {
  assert(!selector.includes('createServerFn') && !selector.includes('supabase'), 'selector has no server/supabase calls');
  assert(!selector.includes('<form') && !productRoute.includes('method='), 'no submit');
  assert(productRoute.includes('<ProductSummaryCard') && selector.includes('aria-live'), 'summary reflects local state');
});

test('no active conversion CTA or financial claims exist', () => {
  const flow = productRoute + offerCard + selector;
  const all = detail + productRoute + offerCard;
  assert(!/\bbuy now\b|\brent now\b|\bdownload now\b/i.test(flow), 'no Buy now / Rent now / Download now');
  assert(!/\$\s?\d|€|gratis/i.test(flow), 'no fake prices in conversion flow');
  assert(!/guarantee.{0,40}(returns?|profit)/i.test(all), 'no return guarantees');
  assert(i18n.includes('offer.priceAnnouncement'), 'price announcement present');
});

test('account links the mapped products to their pages', () => {
  assert(account.includes('commercialCatalog') && account.includes('/products/$productId'), 'account lists products');
  assert(account.includes('account.productOptions'), 'see-options CTA in account');
});

test('demo monitoring stays coming_soon / not connected and auth continues', () => {
  assert(detail.includes('monitorNotConnected') || detail.includes("Not connected yet"), 'monitor placeholder');
  assert(offerCard.includes('getAuthStatus'), 'auth-aware CTA');
  assert(detail.includes('EasyStartSteps') || detail.includes('EasyStartSteps'), 'easy install intact');
});

test('responsive + accessibility affordances are present', () => {
  assert(/@media\(max-width:760px\)[\s\S]*\.mode-selector/.test(css), 'mobile stacks selector');
  assert(selector.includes('role="radio"') && selector.includes('aria-checked'), 'radio a11y');
  assert(selector.includes('aria-live') && productRoute.includes('aria-label'), 'aria-live + labels');
  assert(css.includes('conversion-grid'), 'conversion grid styled');
});

test('strategy data and Quantora Score remain intact', () => {
  assert(publicStrategies.length === 4, 'four strategies');
  const ids = publicStrategies.map((s) => s.id).sort();
  assert(JSON.stringify(ids) === JSON.stringify(['first-triangle-adaptive', 'first-triangle-gold-adaptive', 'stochextreme-adaptive', 'tm-bandas-s3']), 'ids unchanged');
  const scores = publicStrategies.map((s) => s.score?.value ?? null).sort((a, b) => (a ?? 0) - (b ?? 0));
  assert(JSON.stringify(scores) === JSON.stringify([68, 71, 97, 98]), 'scores unchanged (68/71/97/98)');
});

test('no demand data, teaser prices or fake lists are introduced', () => {
  const flow = (productRoute + selector + offerCard + account).toLowerCase();
  assert(!/you are (now )?on the list|waitlist|converted|\$\s?49|\$\s?299/.test(flow), 'no fake signups/prices in conversion flow');
  assert(!/Te avisaremos/.test(i18n) || i18n.includes('summaryNextText'), 'no false notify promise');
});

// ---------------------------------------------------------------------------
// Delivery integrity (mirrors QNT-0014C pattern): the ZIP holds all source,
// and PACKAGE_INTEGRITY is an external artifact verified after the ZIP closes.
// ---------------------------------------------------------------------------
test('delivery package present and integrity is an external artifact', () => {
  const zipPath = resolve(ROOT, 'agent-deliveries/freebuff/QNT-0015_Cambios.zip.txt');
  const hasZip = (() => {
    try {
      return readFileSync(zipPath).length > 0;
    } catch {
      return false;
    }
  })();
  assert(hasZip, 'QNT-0015_Cambios.zip.txt exists');
  const integrity = (() => {
    try {
      return read('agent-deliveries/freebuff/QNT-0015_PACKAGE_INTEGRITY.txt');
    } catch {
      return '';
    }
  })();
  assert(integrity.includes('PACKAGE INTEGRITY') || integrity.includes('SHA-256'), 'integrity doc present');
  assert(!read('agent-deliveries/freebuff/QNT-0015_Cambios.zip.txt').includes('placeholder'), 'zip is real content');
});

// ---------------------------------------------------------------------------

let failures = 0;
for (const { name, run } of tests) {
  try {
    run();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
}
console.log(`\nQNT-0015: ${tests.length - failures}/${tests.length} passed`);
if (failures > 0) process.exit(1);
