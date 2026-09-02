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
// 5. Honest commercial state + no verified-live framing.
// ---------------------------------------------------------------------------
test('commercial access is honest and never claims live results', () => {
  assert(i18n.includes('Commercial access opening soon'), 'commercial opening copy present');
  assert(i18n.includes('Join the waitlist'), 'waitlist copy present');
  assert(i18n.includes('Get notified when available'), 'notify copy present');
  assert(i18n.includes('Interest registration will be enabled in a later phase'), 'waitlist is honest about persistence');
  assert(detail.includes('detail.commercialOpeningSoon'), 'detail renders commercial opening state');
  assert(detail.includes('detail.joinWaitlist'), 'detail renders the waitlist CTA');
  assert(!detail.includes('Verified live result'), 'detail must not claim verified live results');
  assert(!monitorCard.includes('Verified live'), 'monitor card must not render a verified-live label');
  assert(
    i18n.includes('Backtest ≠ Demo monitoring ≠ Real account results'),
    'separation legend uses Real account results',
  );
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