/**
 * QNT-0020 · Public product truth and active catalog.
 *
 *   bun run scripts/test-qnt-0020.ts
 *
 * Verifies that the four real strategies are presented as published products,
 * that editorial/provenance states never reach the public bundle or UI, that
 * no fictional prices/licenses or demo-first messaging remain, that the
 * waitlist is honest, and that payments/downloads/demo monitoring stay off.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicCatalog, publicStrategies } from '../src/catalog.ts';
import { buildCommercialCatalog } from '../src/commercial/catalog.ts';
import { getFeatureFlags } from '../src/config.ts';

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
const card = read('src/components/PublicStrategyCard.tsx');
const home = read('src/routes/index.tsx');
const catalog = read('src/routes/strategies.index.tsx');
const nav = read('src/components/Nav.tsx');
const i18n = read('src/i18n/index.ts');
const monitorCard = read('src/components/DemoMonitoringCard.tsx');
const dash = read('src/routes/dashboard.tsx');

// ---------------------------------------------------------------------------
// 1. The four strategies are published.
// ---------------------------------------------------------------------------
test('the four real strategies are published and carry metrics + equity', () => {
  const ids = publicStrategies.map((s) => s.id).sort();
  assert(
    JSON.stringify(ids) ===
      JSON.stringify([
        'first-triangle-adaptive',
        'first-triangle-gold-adaptive',
        'stochextreme-adaptive',
        'tm-bandas-s3',
      ]),
    `unexpected catalog ids: ${ids.join(', ')}`,
  );
  for (const s of publicStrategies) {
    assert(Boolean(s.metrics && Object.keys(s.metrics).length > 0), `${s.id} must have metrics`);
    assert(Boolean(s.equity && s.equity.points.length >= 2), `${s.id} must have an equity curve`);
    assert(typeof s.score?.value === 'number', `${s.id} must have a Quantora Score`);
  }
});

// ---------------------------------------------------------------------------
// 2. Editorial/provenance states never reach the public bundle.
// ---------------------------------------------------------------------------
test('no editorial or review states leak into the public catalog', () => {
  const raw = JSON.stringify(publicCatalog);
  for (const needle of [
    'reviewLabel',
    'independentReproduction',
    'scoreVersion',
    'filterVersion',
    'publicationMode',
    'beta-1',
    'under review',
    'Under Review',
  ]) {
    assert(!raw.includes(needle), `public catalog must not contain "${needle}"`);
  }
  for (const s of publicStrategies) {
    const record = s as unknown as Record<string, unknown>;
    assert(record.reviewLabel === undefined, `${s.id} must not carry reviewLabel`);
    assert(record.independentReproduction === undefined, `${s.id} must not carry independentReproduction`);
    assert(record.scoreVersion === undefined, `${s.id} must not carry scoreVersion`);
    assert(record.filterVersion === undefined, `${s.id} must not carry filterVersion`);
    assert(record.publicationMode === undefined, `${s.id} must not carry publicationMode`);
    assert(record.dataStatus === undefined, `${s.id} must not carry dataStatus`);
    assert(record.validationStatus === undefined, `${s.id} must not carry validationStatus`);
  }
});

// ---------------------------------------------------------------------------
// 3. No Coming soon / Beta / Owner supplied labels in the UI.
// ---------------------------------------------------------------------------
test('strategy cards show Published strategy + Historical backtest, never Coming soon', () => {
  assert(card.includes("'catalog.publishedStrategy'"), 'card must render Published strategy');
  assert(card.includes("'catalog.historicalBacktest'"), 'card must render Historical backtest');
  assert(i18n.includes("'catalog.comingSoon'") === false || !card.includes('catalog.comingSoon'), 'card must not render Coming soon');
  assert(!card.includes('score-beta'), 'card must not render a Beta score badge');
  assert(!card.includes('scoreVersion'), 'card must not reference the score version');
  assert(!detail.includes('score-beta') && !detail.includes('Beta methodology'), 'detail must not render Beta methodology');
  assert(!detail.includes('scoreVersion'), 'detail must not reference an editorial score version');
  assert(!i18n.includes('Owner supplied'), 'dictionary must not expose Owner supplied');
  assert(!i18n.includes('Independent reproduction pending'), 'dictionary must not expose reproduction status');
});

// ---------------------------------------------------------------------------
// 4. No fictional prices, allocations or licenses.
// ---------------------------------------------------------------------------
test('no invented prices, allocations or licenses remain in the UI', () => {
  for (const needle of ['$49', '$299', 'Simulate allocation', 'Demo allocation', 'Mock license', 'License model · MOCK']) {
    assert(!detail.includes(needle), `detail must not contain "${needle}"`);
    assert(!i18n.includes(needle), `i18n must not contain "${needle}"`);
  }
  assert(!detail.includes('<LicensePicker'), 'mock license picker must be gone');
});

// ---------------------------------------------------------------------------
// 5. Honest early-access state + no verified-live framing.
// ---------------------------------------------------------------------------
test('early access is honest, never claims live results and never fakes saving', () => {
  for (const file of [i18n, home, detail, catalog]) {
    assert(!file.includes('Commercial access opening soon'), 'public surface must not say "Commercial access opening soon"');
  }
  for (const file of [home, detail]) {
    assert(file.includes('detail.getAccessUpdates') || file.includes('home.getAccessUpdates'), 'account-based early access CTA rendered');
  }
  assert(i18n.includes('Early access'), 'early access eyebrow present');
  assert(i18n.includes('Nothing is collected on this page'), 'early access copy states nothing is collected');
  assert(i18n.includes('no purchase, rental or download is available'), 'no commercial transaction may be implied');
  assert(!detail.includes('Verified live result'), 'detail must not claim verified live results');
  assert(!monitorCard.includes('Verified live'), 'monitor card must not render a verified-live label');
  assert(
    i18n.includes('Backtest ≠ Demo monitoring ≠ Real account results'),
    'separation legend uses Real account results',
  );
});

// ---------------------------------------------------------------------------
// 5b. Cards and details disclose costs without badges or unsupported claims.
// ---------------------------------------------------------------------------
test('published cards never say "Costs not applied" and disclose costs discreetly', () => {
  assert(!card.includes('Costs not applied'), 'card must not render "Costs not applied"');
  assert(!card.includes('card.costsNotApplied'), 'card must not reference the old badge key');
  assert(card.includes('card.costsNotIncluded'), 'card renders the discreet costs note');
  assert(
    card.includes("s.costsApplied === false && <p className=\"cost-note\">"),
    'the note appears only when costsApplied=false, before the CTA',
  );
  assert(!i18n.includes('Costs not applied'), 'dictionary must not contain "Costs not applied"');
});

test('detail explains trading costs per strategy without overstating them', () => {
  assert(detail.includes('detail.tradingCosts'), 'detail renders a Trading costs section');
  assert(detail.includes('detail.costsNotIncludedCopy'), 'detail renders the excluded-costs copy');
  assert(detail.includes('detail.costsIncludedCopy'), 'detail renders the included-data copy');
  assert(i18n.includes('This backtest does not include commission, spread, slippage or swap'), 'excluded-costs wording is exact');
  assert(
    i18n.includes('Reported results include the available commission data. Other broker costs are included only when supplied by the source.'),
    'included-costs wording never claims spread/slippage/swap were applied',
  );
  assert(!detail.includes('detail.costsNotApplied'), 'detail must not render the badge string');
});

test('the methodology states costs are shown exactly as provided', () => {
  assert(
    i18n.includes('Trading costs are shown exactly as provided by each backtest'),
    'single methodology note about trading costs is present',
  );
  assert(detail.includes('detail.tradingCostsMethodology'), 'methodology note is rendered on the detail page');
});

// ---------------------------------------------------------------------------
// 5c. No duplicated primary navigation (desktop or mobile).
// ---------------------------------------------------------------------------
test('navigation has one Strategies link per menu and no duplicate on home', () => {
  const homeExtra = home.slice(home.indexOf('extra='), home.indexOf('</Nav>'));
  assert(!homeExtra.includes('nav.strategies'), 'home extra nav must not duplicate Strategies');
  assert(!homeExtra.includes('home.joinWaitlist'), 'home extra nav must not duplicate a waitlist CTA');
  const desktop = nav.slice(nav.indexOf('<div className="links">'), nav.indexOf('</div>', nav.indexOf('<div className="links">')));
  assert((desktop.match(/to="\/strategies"/g) ?? []).length === 1, 'desktop menu has exactly one Strategies link');
  const mobileStart = nav.indexOf('className="mobile-menu"');
  const mobile = nav.slice(mobileStart, nav.indexOf('{extra}', mobileStart));
  assert((mobile.match(/to="\/strategies"/g) ?? []).length === 1, 'mobile menu has exactly one Strategies link');
  assert(home.includes('href="#compare"'), 'Compare strategies remains a real home section link');
});

// ---------------------------------------------------------------------------
// 5d. Global footer is professional: no demo closing, no legal placeholder.
// ---------------------------------------------------------------------------
test('global footer has no "Demo experience" closing and no legal placeholder notice', () => {
  const footer = read('src/components/Footer.tsx');
  assert(!footer.includes('footer.legalReview'), 'footer must not render the legal placeholder notice');
  assert(
    i18n.includes("'footer.rights': 'Historical results do not guarantee future performance. Not financial advice.'"),
    'footer closing is the professional disclaimer',
  );
  assert(!i18n.includes('Demo experience'), 'dictionary must not contain "Demo experience"');
});

// ---------------------------------------------------------------------------
// 5e. Strategy metrics are untouched fixtures are not in the public surface.
// ---------------------------------------------------------------------------
test('strategy metrics still match their manifests (no data changes)', () => {
  const ids = [
    'first-triangle-adaptive',
    'first-triangle-gold-adaptive',
    'stochextreme-adaptive',
    'tm-bandas-s3',
  ];
  for (const id of ids) {
    const manifest = JSON.parse(read(`public-strategies/manifests/${id}.manifest.json`));
    const strategy = publicStrategies.find((s) => s.id === id)!;
    const metrics = strategy.metrics ?? {};
    const source = manifest.results?.metrics ?? {};
    for (const [key, value] of Object.entries(source) as [string, number][]) {
      if (typeof value === 'number' && Number.isFinite(value) && metrics[key] !== undefined) {
        assert(metrics[key] === value, `metric "${key}" changed for ${id} (${metrics[key]} vs ${value})`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 5f. Demo experiences stay unmistakably labelled as demo.
// ---------------------------------------------------------------------------
test('demo experiences remain clearly identified as demo', () => {
  assert(detail.includes('<DemoMonitoringCard'), 'detail keeps the demo monitoring module');
  assert(i18n.includes("'detail.monitorEyebrow': 'Demo monitoring'"), 'monitoring module heading says Demo monitoring');
  assert(monitorCard.includes('monitor.disclaimer'), 'monitoring module renders the demo disclaimer');
  assert(dash.includes('dashboard.demo'), 'dashboard surfaces the demo/account state label');
});

// ---------------------------------------------------------------------------
// 5g. The global header never renders the mock banner.
// ---------------------------------------------------------------------------
test('the global header does not render a MOCK ENVIRONMENT banner', () => {
  assert(!nav.includes('nav.mockEnvironment'), 'header must not render the mock environment banner');
  assert(nav.includes('to="/register"') && nav.includes('nav.createAccount'), 'Create account CTA still present');
  assert(nav.includes('to="/login"') && nav.includes('nav.signIn'), 'Sign in link still present');
});

// ---------------------------------------------------------------------------
// 6. Quantora Score and Historical backtest present; formula unchanged.
// ---------------------------------------------------------------------------
test('Quantora Score and Historical backtest are the public labels', () => {
  assert(i18n.includes("'detail.score': 'Quantora Score'"), 'score label is Quantora Score');
  assert(i18n.includes('Comparative score calculated consistently from the historical evidence available for each strategy'), 'score tooltip is the comparative explanation');
  assert(i18n.includes('Historical backtest'), 'historical backtest label present');
  assert(detail.includes("'detail.historicalBacktest'") || detail.includes("t('detail.historicalBacktest')"), 'detail shows Historical backtest');
});

// ---------------------------------------------------------------------------
// 7. Payments, downloads and demo monitoring remain disabled.
// ---------------------------------------------------------------------------
test('commercial capabilities stay disabled', () => {
  const flags = getFeatureFlags();
  assert(flags.paymentsEnabled === false, 'payments must remain disabled');
  assert(flags.downloadsEnabled === false, 'downloads must remain disabled');
  assert(flags.demoMonitoringEnabled === false, 'demo monitoring must remain disabled');
  for (const p of buildCommercialCatalog()) {
    assert(p.availability.canStartCheckout === false, `${p.productId} must not allow checkout`);
    assert(p.availability.canDownload === false, `${p.productId} must not allow download`);
    assert(p.commercialDownloadEnabled === false, `${p.productId} download flag must be false`);
  }
});

// ---------------------------------------------------------------------------
// 8. The published catalog dominates home and /strategies.
// ---------------------------------------------------------------------------
test('home and catalog surface only the published strategies', () => {
  assert(home.includes('publicStrategies'), 'home must consume the public catalog');
  assert(catalog.includes('publicStrategies'), 'catalog must consume the public catalog');
  assert(!home.includes("from '../data'"), 'home must not import mock strategy data');
  assert(!catalog.includes("from '../data'"), 'catalog must not import mock strategy data');
  assert(!catalog.includes('demoReturn'), 'catalog must not render demo returns');
  assert(!home.includes('demoReturn'), 'home must not render demo returns');
});

// ---------------------------------------------------------------------------
// 9. Header: Create account / My account without promoting the demo dashboard.
// ---------------------------------------------------------------------------
test('header surfaces account CTAs and does not promote the demo dashboard', () => {
  assert(nav.includes("to=\"/register\"") && nav.includes('nav.createAccount'), 'header links to Create account');
  assert(nav.includes("to=\"/login\"") && nav.includes('nav.signIn'), 'header links to Sign in');
  assert(nav.includes('nav.myAccount'), 'header links to My account for signed-in users');
  assert(!nav.includes('to="/dashboard"'), 'header must not promote the mock dashboard');
});

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.run();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`✗ ${t.name}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`Tests executed: ${tests.length} | passed: ${passed} | failed: ${failed}`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);