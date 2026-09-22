/**
 * QNT-0041 · Public pricing visibility contract tests (offline, no network, no secrets).
 *
 * - Prices are versioned catalog data generated from manifests.
 * - Only `active` plans with a positive integer amount and a currency are public.
 * - Invalid plans are blocking manifest errors (zero price, bad currency,
 *   incoherent interval, duplicate billing model, plans without productId).
 * - Nothing is on sale yet: `productStatus` stays `coming_soon` and
 *   `commercialDownloadEnabled` stays false, so no checkout is advertised.
 * - The generated catalog carries 300 EUR one-time and 10 EUR per month.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateManifest } from '../scripts/intake/manifest';
import { toPublicPlans } from '../scripts/intake/pipeline';
import {
  formatPlanPrice,
  isDisplayablePlan,
  planIntervalLabelKey,
  summarizePublicPlans,
} from '../src/domain/commercial/publicPlans';
import type { PublicPlan, PublicStrategy } from '../src/domain/publicStrategy';

let failures = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) console.log(`ok - ${name}`);
  else {
    failures++;
    console.error(`FAIL - ${name} ${extra}`);
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
}

/** Blocking manifest errors mentioning a given path prefix. */
function manifestErrors(manifest: unknown, path: string): number {
  return validateManifest(manifest)
    .filter((issue) => issue.level === 'error')
    .filter((issue) => issue.path.startsWith(path)).length;
}

// ---------------------------------------------------------------------------
// 1. Manifest contract: what is a valid price declaration
// ---------------------------------------------------------------------------
const manifestPath = 'public-strategies/manifests/first-triangle-adaptive.manifest.json';
const base = readJson(manifestPath) as Record<string, unknown>;
check('real manifest declares no blocking errors', manifestErrors(base, '') === 0);

const plansOf = (manifest: Record<string, unknown>): Record<string, unknown>[] =>
  (manifest.commercial as Record<string, unknown>).plans as Record<string, unknown>[];

const clone = (): Record<string, unknown> => structuredClone(base);

const zeroPrice = clone();
plansOf(zeroPrice)[0].priceAmountMinor = 0;
check(
  'active plan with zero price is rejected',
  manifestErrors(zeroPrice, 'commercial.plans[0].priceAmountMinor') > 0,
);

const draftNoPrice = clone();
plansOf(draftNoPrice)[0] = { billingModel: 'purchase', billingInterval: 'one_time', status: 'draft' };
check(
  'draft plan without price is allowed (draft is never published)',
  manifestErrors(draftNoPrice, '') === 0,
);

const badCurrency = clone();
plansOf(badCurrency)[1].currency = 'eur';
check('lowercase currency is rejected', manifestErrors(badCurrency, 'commercial.plans[1].currency') > 0);

const missingCurrency = clone();
delete plansOf(missingCurrency)[1].currency;
check(
  'active plan without currency is rejected',
  manifestErrors(missingCurrency, 'commercial.plans[1].currency') > 0,
);

const badInterval = clone();
plansOf(badInterval)[1].billingInterval = 'one_time';
check('rental + one_time is rejected', manifestErrors(badInterval, 'commercial.plans[1].billingInterval') > 0);

const duplicate = clone();
plansOf(duplicate)[1].billingModel = 'purchase';
check('duplicate billing model is rejected', manifestErrors(duplicate, 'commercial.plans[1]') > 0);

const noProduct = clone();
delete noProduct.productId;
check('plans without productId are rejected', manifestErrors(noProduct, 'commercial.plans') > 0);

// ---------------------------------------------------------------------------
// 2. Projection: only active + priced plans reach the public bundle
// ---------------------------------------------------------------------------
const projected = toPublicPlans(
  {
    plans: [
      { billingModel: 'purchase', billingInterval: 'one_time', status: 'active', priceAmountMinor: 30000, currency: 'EUR' },
      { billingModel: 'rental', billingInterval: 'monthly', status: 'active', priceAmountMinor: 1000, currency: 'EUR' },
      { billingModel: 'rental', billingInterval: 'annual', status: 'draft', priceAmountMinor: 10000, currency: 'EUR' },
      { billingModel: 'rental', billingInterval: 'quarterly', status: 'retired', priceAmountMinor: 2700, currency: 'EUR' },
    ],
  },
  'demo-product',
);
check('two active plans are projected', projected?.length === 2, JSON.stringify(projected));
check(
  'plan identifiers are derived from the product',
  projected?.[0]?.planId === 'demo-product-purchase' && projected?.[1]?.planId === 'demo-product-rental',
);
check(
  'draft and retired plans never reach the public bundle',
  !JSON.stringify(projected).includes('annual') && !JSON.stringify(projected).includes('quarterly'),
);
check('no plans declared means nothing published', toPublicPlans({ plans: [] }, 'demo-product') === undefined);
check(
  'no productId means nothing published',
  toPublicPlans(
    { plans: [{ billingModel: 'rental', billingInterval: 'monthly', status: 'active', priceAmountMinor: 1000, currency: 'EUR' }] },
    undefined,
  ) === undefined,
);

// ---------------------------------------------------------------------------
// 3. Display helpers: no invented prices, never "0" or "free"
// ---------------------------------------------------------------------------
const plan = (
  amount: number,
  currency = 'EUR',
  interval: PublicPlan['billingInterval'] = 'one_time',
): PublicPlan => ({
  planId: 'p',
  billingModel: interval === 'one_time' ? 'purchase' : 'rental',
  billingInterval: interval,
  priceAmountMinor: amount,
  currency,
});

check('zero amount is not displayable', isDisplayablePlan(plan(0)) === false);
check('negative amount is not displayable', isDisplayablePlan(plan(-100)) === false);
check(
  'non-integer amount is not displayable',
  isDisplayablePlan({ ...plan(100), priceAmountMinor: 10.5 }) === false,
);
check(
  '300 EUR renders as 300 EUR in Spanish',
  formatPlanPrice(plan(30000), 'es').replace(/\u00A0/g, ' ') === '300 €',
  formatPlanPrice(plan(30000), 'es'),
);
check(
  '10 EUR renders as 10 EUR in Spanish',
  formatPlanPrice(plan(1000, 'EUR', 'monthly'), 'es').replace(/\u00A0/g, ' ') === '10 €',
);
check(
  'interval labels are translated keys',
  planIntervalLabelKey(plan(1000, 'EUR', 'monthly')) === 'pricing.interval.monthly' &&
    planIntervalLabelKey(plan(30000)) === 'pricing.interval.one_time',
);
const emptySummary = summarizePublicPlans(undefined);
check(
  'no plans means an empty summary (renders nothing)',
  emptySummary.hasAny === false && emptySummary.purchase === null && emptySummary.rental === null,
);
const mixedSummary = summarizePublicPlans([plan(30000), plan(0, 'EUR', 'monthly')]);
check(
  'a non-displayable rental is ignored',
  mixedSummary.purchase?.priceAmountMinor === 30000 && mixedSummary.rental === null,
);

// ---------------------------------------------------------------------------
// 4. Generated catalog: real prices, and nothing on sale yet
// ---------------------------------------------------------------------------
const catalog = readJson('public-strategies/catalog.json') as {
  generatedAt: string;
  strategies: PublicStrategy[];
};
check('catalog publishes three strategies', catalog.strategies.length === 3, String(catalog.strategies.length));

const PUBLIC_PLAN_KEYS = ['planId', 'billingModel', 'billingInterval', 'priceAmountMinor', 'currency'];
for (const strategy of catalog.strategies) {
  const summary = summarizePublicPlans(strategy.plans);
  check(
    `${strategy.id} shows a 300 EUR one-time purchase`,
    summary.purchase?.priceAmountMinor === 30000 && summary.purchase?.currency === 'EUR',
  );
  check(
    `${strategy.id} shows a 10 EUR per month rental`,
    summary.rental?.priceAmountMinor === 1000 && summary.rental?.currency === 'EUR',
  );
  check(
    `${strategy.id} advertises no sale yet (coming_soon, download disabled)`,
    strategy.productStatus === 'coming_soon' && strategy.commercialDownloadEnabled === false,
  );
  const leaked = Object.keys(strategy.plans?.[0] ?? {}).filter((key) => !PUBLIC_PLAN_KEYS.includes(key));
  check(`${strategy.id} exposes no internal plan fields`, leaked.length === 0, leaked.join(','));
}

if (failures > 0) {
  console.error(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('ALL PUBLIC PRICING CHECKS PASSED');
