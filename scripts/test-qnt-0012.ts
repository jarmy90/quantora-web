/**
 * QNT-0012 · Commercial foundation regression tests.
 *
 * Runs with bun (no third-party deps):
 *   bun run scripts/test-qnt-0012.ts
 *
 * Verifies the safe commercial and user foundation: four derived products,
 * state-machine rules, environment contract, safe catalog, migration and UI
 * readiness — and that nothing commercial is actually enabled.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { commercialCatalog, buildCommercialCatalog } from '../src/commercial/catalog.ts';
import { publicCatalog, publicStrategies } from '../src/catalog.ts';
import {
  getFeatureFlags,
  getPublicFeatureFlags,
  resolveAppEnv,
} from '../src/config.ts';
import { isBillingCombinationValid } from '../src/domain/commercial/plan.ts';
import {
  canActivateLicense,
  canGrantDownload,
  canMarkOrderPaidFromClient,
  canPurchaseProduct,
  canSelectPlan,
  canStartCheckout,
  downloadBlockedReason,
  getProductAvailability,
} from '../src/domain/commercial/rules.ts';

const ROOT = resolve(import.meta.dir, '..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

const tests: { name: string; run: () => void }[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// Derived commercial catalog
// ---------------------------------------------------------------------------

test('exactly four commercial products are derived, distinct from strategy ids', () => {
  const products = buildCommercialCatalog();
  assert(products.length === 4, `expected 4 products, got ${products.length}`);
  const ids = products.map((p) => p.productId).sort();
  assert(
    JSON.stringify(ids) ===
      JSON.stringify([
        'first-triangle-gold-m15',
        'first-triangle-ustec-m30',
        'stochextreme-ustec',
        'tm-bandas-s3-keeper',
      ]),
    `unexpected product ids: ${ids.join(', ')}`,
  );
  for (const p of products) {
    assert(p.productId !== p.strategyId, `${p.productId} must differ from strategyId`);
  }
});

test('all products are coming_soon with download disabled and no availability', () => {
  const products = buildCommercialCatalog();
  for (const p of products) {
    assert(p.productStatus === 'coming_soon', `${p.productId} must be coming_soon`);
    assert(p.commercialDownloadEnabled === false, `${p.productId} download must be disabled`);
    assert(p.availability.canStartCheckout === false, `${p.productId} must not allow checkout`);
    assert(p.availability.canDownload === false, `${p.productId} must not allow download`);
  }
});

test('safe catalog exposes only safe fields', () => {
  const raw = JSON.stringify(commercialCatalog);
  // deliveryFormat 'ex5' is the allowed delivery format; forbidden EA-file
  // references (with a leading dot / archive / vault) must never appear.
  for (const needle of ['vault', 'sourceArchive', 'delivery-path', 'credentials', '.mq5', '.ex5', '.set', 'sha256']) {
    assert(!raw.includes(needle), `safe catalog must not contain "${needle}"`);
  }
  for (const p of commercialCatalog) {
    assert(Object.keys(p).every((k) => ['productId', 'strategyId', 'displayName', 'productStatus', 'deliveryFormat', 'commercialDownloadEnabled', 'availability'].includes(k)),
      `${p.productId} exposes an unexpected field`);
  }
});

// ---------------------------------------------------------------------------
// State rules
// ---------------------------------------------------------------------------

test('coming_soon / paused / deprecated / not_listed products cannot be purchased', () => {
  for (const status of ['not_listed', 'coming_soon', 'paused', 'deprecated'] as const) {
    assert(!canPurchaseProduct({ status }), `${status} must not be purchasable`);
  }
  assert(canPurchaseProduct({ status: 'available' }), 'available must be purchasable');
});

test('draft and inactive plans cannot be selected; null price is never usable', () => {
  const draft = { status: 'draft' as const, billingModel: 'rental' as const, billingInterval: 'monthly' as const, priceAmountMinor: null as number | null, currency: null as string | null };
  const inactive = { ...draft, status: 'inactive' as const };
  const activeNoPrice = { ...draft, status: 'active' as const };
  const activeZero = { status: 'active' as const, billingModel: 'rental' as const, billingInterval: 'monthly' as const, priceAmountMinor: 0, currency: 'EUR' };
  const activePriced = { status: 'active' as const, billingModel: 'rental' as const, billingInterval: 'monthly' as const, priceAmountMinor: 4900, currency: 'EUR' };
  assert(!canSelectPlan(draft), 'draft must not be selectable');
  assert(!canSelectPlan(inactive), 'inactive must not be selectable');
  assert(!canSelectPlan(activeNoPrice), 'active without price must not be selectable');
  assert(!canSelectPlan(activeZero), 'zero price must not be usable');
  assert(canSelectPlan(activePriced), 'active priced plan must be selectable');
});

test('billing model/interval combinations are validated (rental ≠ one_time, purchase ≠ recurring)', () => {
  const rental = (interval: 'monthly' | 'quarterly' | 'annual' | 'one_time') => ({ billingModel: 'rental' as const, billingInterval: interval });
  const purchase = (interval: 'monthly' | 'quarterly' | 'annual' | 'one_time') => ({ billingModel: 'purchase' as const, billingInterval: interval });
  assert(isBillingCombinationValid(rental('monthly')), 'rental + monthly must be valid');
  assert(isBillingCombinationValid(rental('quarterly')), 'rental + quarterly must be valid');
  assert(isBillingCombinationValid(rental('annual')), 'rental + annual must be valid');
  assert(!isBillingCombinationValid(rental('one_time')), 'rental + one_time must be invalid');
  assert(isBillingCombinationValid(purchase('one_time')), 'purchase + one_time must be valid');
  assert(!isBillingCombinationValid(purchase('monthly')), 'purchase + monthly must be invalid');
  assert(!isBillingCombinationValid(purchase('quarterly')), 'purchase + quarterly must be invalid');
  assert(!isBillingCombinationValid(purchase('annual')), 'purchase + annual must be invalid');
});

test('canSelectPlan rejects invalid billing combinations even when active and priced', () => {
  const activePriced = (billingModel: 'rental' | 'purchase', billingInterval: 'monthly' | 'quarterly' | 'annual' | 'one_time') => ({
    status: 'active' as const, billingModel, billingInterval, priceAmountMinor: 4900, currency: 'EUR',
  });
  assert(canSelectPlan(activePriced('rental', 'monthly')), 'rental monthly must be selectable');
  assert(canSelectPlan(activePriced('purchase', 'one_time')), 'purchase one_time must be selectable');
  assert(!canSelectPlan(activePriced('rental', 'one_time')), 'rental one_time must be rejected');
  assert(!canSelectPlan(activePriced('purchase', 'monthly')), 'purchase monthly must be rejected');
  assert(!canSelectPlan(activePriced('purchase', 'quarterly')), 'purchase quarterly must be rejected');
  assert(!canSelectPlan(activePriced('purchase', 'annual')), 'purchase annual must be rejected');
});

test('checkout cannot start with current data (no available product, no plans)', () => {
  const product = { status: 'coming_soon' as const, commercialDownloadEnabled: false };
  const availability = getProductAvailability(product, []);
  assert(!canStartCheckout(product, []), 'coming_soon must not start checkout');
  assert(!availability.canStartCheckout, 'availability must not start checkout');
  assert(availability.canDownload === false, 'availability must not allow download');
});

test('order can never be marked paid from the client', () => {
  assert(!canMarkOrderPaidFromClient(), 'paid must never come from the client');
});

test('license cannot activate without a paid order', () => {
  assert(!canActivateLicense({ status: 'pending' }, { status: 'pending_payment' }), 'pending order must not activate');
  assert(!canActivateLicense({ status: 'active' }, { status: 'paid' }), 'already-active must not be re-activated');
  assert(canActivateLicense({ status: 'pending' }, { status: 'paid' }), 'pending license + paid order may activate');
});

test('download requires every condition; current data always blocks', () => {
  const blocked = { status: 'coming_soon' as const, commercialDownloadEnabled: false };
  const base = {
    product: blocked,
    license: { status: 'pending' as const },
    entitlement: { status: 'pending' as const, canDownload: false },
  };
  assert(!canGrantDownload(base), 'coming_soon must never grant download');
  assert(downloadBlockedReason(base) !== null, 'block reason must not be silent');

  const all = {
    product: { status: 'available' as const, commercialDownloadEnabled: true },
    license: { status: 'active' as const },
    entitlement: { status: 'granted' as const, canDownload: true },
  };
  assert(canGrantDownload(all), 'all conditions met must grant download');
  assert(
    !canGrantDownload({ ...all, product: { status: 'available', commercialDownloadEnabled: false } }),
    'download disabled must dominate',
  );
});

// ---------------------------------------------------------------------------
// Environment contract
// ---------------------------------------------------------------------------

test('commercial feature flags default to false', () => {
  const flags = getFeatureFlags({});
  assert(flags.authEnabled === false, 'authEnabled must default false');
  assert(flags.paymentsEnabled === false, 'paymentsEnabled must default false');
  assert(flags.downloadsEnabled === false, 'downloadsEnabled must default false');
  assert(flags.demoMonitoringEnabled === false, 'demoMonitoringEnabled must default false');
  const pub = getPublicFeatureFlags();
  assert(Object.values(pub).every((v) => typeof v === 'boolean'), 'public flags must be booleans only');
});

test('app env resolution distinguishes environments', () => {
  assert(resolveAppEnv({}) === 'development', 'default must be development');
  assert(resolveAppEnv({ APP_ENV: 'production' }) === 'production', 'production must resolve');
  assert(resolveAppEnv({ APP_ENV: 'staging' }) === 'staging', 'staging must resolve');
  assert(resolveAppEnv({ APP_ENV: 'test' }) === 'test', 'test must resolve');
});

test('config never exposes secrets and uses no VITE_ for secrets', () => {
  const config = read('src/config.ts');
  assert(!config.includes('PAYMENT_SECRET_KEY'), 'config must not return payment secrets');
  assert(!config.includes('AUTH_SECRET'), 'config must not return auth secrets');
  assert(!config.includes('DATABASE_URL') || config.includes('hasDatabaseUrl'), 'database url handled as presence only');
});

test('.env.example contains no secret values', () => {
  const example = read('.env.example');
  assert(!example.includes('ghp_'), 'no GitHub token');
  assert(!example.includes('sk_'), 'no stripe-style secret');
  assert(!example.includes('AKIA'), 'no AWS key');
  assert(!example.includes('password=') || example.includes('password=') === false, 'no inline passwords');
  for (const line of example.split(/\r?\n/)) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const value = line.split('=', 2)[1] ?? '';
    // Empty values are required, except the documented public feature flags
    // which must explicitly default to false.
    if (value.trim() === 'false') continue;
    assert(value.trim() === '', `variable must have an empty value: ${line.trim()}`);
  }
});

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

test('migration creates the seven tables and seeds only the four products', () => {
  const sql = read('db/migrations/0001_commercial_foundation.sql').toLowerCase();
  for (const table of ['products', 'plans', 'customers', 'orders', 'payments', 'licenses', 'entitlements']) {
    assert(sql.includes(`create table if not exists ${table}`), `migration must create ${table}`);
  }
  const insertInto = sql.match(/insert into\s+(\w+)/g) ?? [];
  assert(insertInto.length === 1 && insertInto[0].includes('products'), `only products may be seeded, got: ${insertInto.join(', ')}`);
  assert((sql.match(/coming_soon/g) ?? []).length >= 4, 'four products must be seeded as coming_soon');
  assert(!sql.includes('insert into customers') && !sql.includes('insert into orders') &&
         !sql.includes('insert into payments') && !sql.includes('insert into licenses') &&
         !sql.includes('insert into entitlements'), 'no customers/orders/payments/licenses/entitlements seeded');
  const sqlWithoutComments = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert(!/\bpassword\b/.test(sqlWithoutComments), 'no password columns');
});

test('products table: id uuid PK, product_id TEXT UNIQUE, no product_key', () => {
  const sql = read('db/migrations/0001_commercial_foundation.sql');
  const table = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS products'), sql.indexOf('CREATE TABLE IF NOT EXISTS plans'));
  assert(/id\s+uuid\s+PRIMARY KEY\s+DEFAULT\s+gen_random_uuid\(\)/i.test(table), 'products must use id uuid primary key');
  assert(/product_id\s+text\s+NOT\s+NULL\s+UNIQUE/i.test(table), 'product_id must be text NOT NULL UNIQUE');
  assert(!/product_key/i.test(table), 'product_key must not exist');
  assert(/strategy_id\s+text\s+NOT\s+NULL\s+UNIQUE/i.test(table), 'strategy_id must be text NOT NULL UNIQUE');
});

test('seed uses the stable product_id and all four known ids', () => {
  const sql = read('db/migrations/0001_commercial_foundation.sql');
  assert(/insert\s+into\s+products\s*\(\s*product_id\s*,/i.test(sql), 'seed must insert product_id');
  assert(!/product_key/i.test(sql), 'seed must not reference product_key');
  for (const id of ['first-triangle-ustec-m30', 'first-triangle-gold-m15', 'stochextreme-ustec', 'tm-bandas-s3-keeper']) {
    assert(sql.includes(id), `seed must include ${id}`);
  }
});

test('commercial foreign keys use product_ref referencing products(id)', () => {
  const sql = read('db/migrations/0001_commercial_foundation.sql');
  for (const table of ['plans', 'orders', 'licenses', 'entitlements']) {
    const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS ${table}`);
    const end = sql.indexOf('CREATE TABLE IF NOT EXISTS', start + 1);
    const section = sql.slice(start, end === -1 ? sql.length : end);
    assert(/product_ref\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+products\s*\(\s*id\s*\)/i.test(section), `${table} must use product_ref uuid references products(id)`);
    assert(!/product_id\s+uuid/i.test(section), `${table} must not use product_id as uuid FK`);
  }
});

test('migration enforces the billing model/interval CHECK', () => {
  const sql = read('db/migrations/0001_commercial_foundation.sql');
  const plansSection = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS plans'), sql.indexOf('CREATE TABLE IF NOT EXISTS customers'));
  assert(/plans_billing_combination/i.test(plansSection), 'plans table must define plans_billing_combination CHECK');
  assert(/billing_model\s*=\s*'rental'[^)]*monthly[^)]*quarterly[^)]*annual/i.test(plansSection), 'rental must admit monthly/quarterly/annual');
  assert(/billing_model\s*=\s*'purchase'[^)]*one_time/i.test(plansSection), 'purchase must admit only one_time');
});

test('ProductRepository looks up by stable findByProductId, not ambiguous findById', () => {
  const repo = read('src/domain/commercial/repositories.ts');
  assert(/findByProductId\s*\(\s*productId\s*:\s*string\s*\)/.test(repo), 'ProductRepository must expose findByProductId(productId: string)');
  const productInterface = repo.slice(repo.indexOf('export interface ProductRepository'), repo.indexOf('export interface PlanRepository'));
  assert(!/findById/.test(productInterface), 'ProductRepository must not expose findById');
  const memory = read('src/domain/commercial/memory-repositories.ts');
  assert(/findByProductId\s*\(\s*productId\s*:\s*string\s*\)/.test(memory), 'memory repo must implement findByProductId');
  assert(!/findById\(\s*productId/.test(memory), 'memory repo must not keep an ambiguous findById');
});

test('Customer email and displayName are nullable until identity is chosen', () => {
  const customer = read('src/domain/commercial/customer.ts');
  assert(/email\s*:\s*string\s*\|\s*null/.test(customer), 'email must be string | null');
  assert(/displayName\s*:\s*string\s*\|\s*null/.test(customer), 'displayName must be string | null');
  const sql = read('db/migrations/0001_commercial_foundation.sql');
  assert(/email\s+text\s+unique/i.test(sql), 'SQL email must remain nullable text unique');
});

// ---------------------------------------------------------------------------
// Strategies and metrics stay intact
// ---------------------------------------------------------------------------

test('the four public strategies and their metrics remain unchanged', () => {
  const ids = publicStrategies.map((s) => s.id).sort();
  assert(ids.length === 4, `expected 4 strategies, got ${ids.length}`);
  assert(!ids.includes('stochextreme-gold'), 'stochextreme-gold must not be public');
  const manifests = [
    'first-triangle-adaptive',
    'first-triangle-gold-adaptive',
    'stochextreme-adaptive',
    'tm-bandas-s3',
  ];
  for (const id of manifests) {
    const manifest = JSON.parse(read(`public-strategies/manifests/${id}.manifest.json`));
    const strategy = publicStrategies.find((s) => s.id === id)!;
    const metrics = strategy.metrics ?? {};
    const source = manifest.results?.metrics ?? {};
    for (const [key, value] of Object.entries(source) as [string, number][]) {
      if (typeof value === 'number' && Number.isFinite(value) && metrics[key] !== undefined) {
        assert(metrics[key] === value, `metric "${key}" changed for ${id}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// UI readiness
// ---------------------------------------------------------------------------

test('real strategy UI has no active Buy/Rent/Checkout/Pay/Download', () => {
  const detail = read('src/routes/strategies.$id.tsx');
  const start = detail.indexOf('function RealDetail');
  const end = detail.indexOf('function MockDetail');
  const realSection = detail.slice(start, end);
  for (const forbidden of ['Checkout', 'Pay now', '<LicensePicker']) {
    assert(!realSection.includes(forbidden), `real detail must not contain "${forbidden}"`);
  }
});

test('dashboard remains a marked preview and shows Account access: not enabled', () => {
  const dash = read('src/routes/dashboard.tsx');
  assert(dash.includes('dashboard.eyebrow'), 'dashboard keeps its mock eyebrow');
  assert(dash.includes('dashboard.accountAccess'), 'dashboard must include Account access section');
  assert(dash.includes('dashboard.notEnabledYet'), 'account access must be Not enabled yet');
});

test('public bundle carries no commercial capability activators', () => {
  const raw = JSON.stringify(publicCatalog);
  assert(!raw.includes('"planId"'), 'public bundle must not expose plans');
  assert(!raw.includes('"paymentId"'), 'public bundle must not expose payments');
  assert(!raw.includes('"licenseId"'), 'public bundle must not expose licenses');
});

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
