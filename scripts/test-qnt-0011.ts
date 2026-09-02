/**
 * QNT-0011 UI/contract regression tests.
 *
 * Runs with bun (no third-party deps):
 *   bun run scripts/test-qnt-0011.ts
 *
 * Verifies the trust surface introduced by QNT-0011: public product states,
 * single-unit points formatting, home page sourced from the public catalog,
 * mobile navigation presence, mock dashboard alignment and absence of
 * invented demo-monitoring data.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicCatalog, publicStrategies } from '../src/catalog.ts';
import { fmtPoints, fmtSignedPoints } from '../src/format.ts';

const ROOT = resolve(import.meta.dir, '..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

const tests: { name: string; run: () => void }[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const EXPECTED_PRODUCTS: Record<string, string> = {
  'first-triangle-adaptive': 'first-triangle-ustec-m30',
  'first-triangle-gold-adaptive': 'first-triangle-gold-m15',
  'stochextreme-adaptive': 'stochextreme-ustec',
  'tm-bandas-s3': 'tm-bandas-s3-keeper',
};

// 1. Public catalog: exactly the four published strategies, no stochextreme-gold.
test('catalog has exactly the four published strategies', () => {
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
  assert(
    !publicStrategies.some((s) => s.id.includes('stochextreme-gold')),
    'stochextreme-gold must not appear in the public catalog',
  );
});

// 2. Product states are present and safe for every published strategy.
test('all four strategies are coming_soon with commercialDownloadEnabled=false', () => {
  assert(publicStrategies.length === 4, 'expected 4 public strategies');
  for (const s of publicStrategies) {
    assert(s.productStatus === 'coming_soon', `${s.id} productStatus must be coming_soon`);
    assert(
      s.commercialDownloadEnabled === false,
      `${s.id} commercialDownloadEnabled must be false`,
    );
    assert(s.productId === EXPECTED_PRODUCTS[s.id], `${s.id} productId mismatch`);
  }
});

// 3. Internal states never cross the public boundary.
test('public bundle carries no internal states or private paths', () => {
  const raw = JSON.stringify(publicCatalog);
  for (const s of publicStrategies) {
    const record = s as unknown as Record<string, unknown>;
    assert(record.status === undefined, `${s.id} must not carry internal "status"`);
    assert(record.dataStatus === undefined, `${s.id} must not carry internal "dataStatus"`);
    assert(record.validationStatus === undefined, `${s.id} must not carry internal "validationStatus"`);
    assert(record.sourceArchive === undefined, `${s.id} must not carry "sourceArchive"`);
    assert(record.evidence === undefined, `${s.id} must not carry evidence hashes`);
  }
  for (const needle of ['mq5', 'ex5', '.set', 'vault']) {
    assert(!raw.includes(needle), `public catalog must not contain "${needle}"`);
  }
});

// 4. "pts pts" regression: points values carry the unit exactly once.
test('points formatting never duplicates the unit (pts pts)', () => {
  const gold = publicStrategies.find((s) => s.performanceUnit === 'points');
  assert(gold !== undefined, 'expected a points-based strategy (First Triangle Gold)');
  const metrics = gold.metrics ?? {};
  const net = fmtSignedPoints(metrics.netPoints ?? 0);
  const dd = fmtPoints(metrics.maxDrawdownPoints ?? 0);
  for (const value of [net, dd]) {
    assert(!value.includes('pts pts'), `duplicated unit in "${value}"`);
    assert(value.split('pts').length === 2, `unit must appear exactly once in "${value}"`);
    assert(value.trim().endsWith('pts'), `value must end with the unit: "${value}"`);
  }
  assert(net.startsWith('+'), `positive net must be signed: "${net}"`);
});

// 5. Cards never render a costs badge (QNT-0020: discreet note only).
test('cards disclose costs discreetly and never render a costs badge', () => {
  const card = read('src/components/PublicStrategyCard.tsx');
  const i18n = read('src/i18n/index.ts');
  assert(!card.includes('costsChip'), 'card must not render a costs chip');
  assert(
    !card.includes('card.costsNotApplied') && !card.includes('card.costsApplied') && !card.includes('card.costsNotConfirmed'),
    'card must not reference old costs badge keys',
  );
  assert(card.includes('card.costsNotIncluded'), 'card renders the discreet costs note key');
  assert(
    card.includes("s.costsApplied === false && <p className=\"cost-note\">"),
    'the note renders only when costsApplied=false',
  );
  assert(
    i18n.includes("'card.costsNotIncluded': 'Backtest results exclude commission, spread, slippage and swap.'"),
    'costs note copy is the required discreet disclosure',
  );
});

// 6. Home page consumes the catalog and hardcodes no real metrics.
test('home consumes the public catalog without hardcoded metrics', () => {
  const home = read('src/routes/index.tsx');
  assert(home.includes("publicStrategies") && home.includes("../catalog"), 'home must import publicStrategies from the catalog');
  for (const literal of ['6,687', '2,368.75', '1.26', '1.90', '4,474.80', '4,690', '6,984', '384.00']) {
    assert(!home.includes(literal), `home must not hardcode metric literal "${literal}"`);
  }
});

// 7. Mobile navigation exists and is accessible.
test('mobile navigation menu is present and accessible', () => {
  const nav = read('src/components/Nav.tsx');
  assert(nav.includes('nav-toggle'), 'mobile toggle button must exist');
  assert(nav.includes('aria-expanded'), 'toggle must expose aria-expanded');
  assert(nav.includes('aria-controls="mobile-menu"'), 'toggle must control the menu');
  assert(nav.includes("event.key === 'Escape'"), 'menu must close on Escape');
  assert(nav.includes('aria-label'), 'menu must expose an accessible name');
});

// 8. Dashboard stays a mock preview aligned with real strategies.
test('dashboard preview is mock and uses the real catalog', () => {
  const dash = read('src/routes/dashboard.tsx');
  assert(dash.includes("publicStrategies"), 'dashboard must consume the real catalog');
  assert(!dash.includes("from '../data'"), 'dashboard must not use mock license/download data');
  assert(dash.includes('dashboard.eyebrow'), 'dashboard keeps its mock eyebrow label');
});

// 9. No active buy/rent/download on real strategy pages.
test('no active buy/rent/download in real strategy UI', () => {
  const detail = read('src/routes/strategies.$id.tsx');
  const realSectionStart = detail.indexOf('function RealDetail');
  const realSectionEnd = detail.indexOf('function MockDetail');
  const realSection = detail.slice(realSectionStart, realSectionEnd);
  assert(realSection.includes('detail.getAccessUpdates'), 'real detail must offer the account-based early access CTA');
  // The picker may be *defined* between the two sections, but it must only be
  // *used* inside the mock detail (never in the real one).
  assert(
    !realSection.includes('<LicensePicker'),
    'real detail must not render the mock buy/rent picker',
  );
  assert(!realSection.includes('Simulate allocation'), 'real detail must not simulate a purchase');
});

// 10. Demo monitoring slot invents no data for real strategies.
test('demo monitoring is not_connected with no invented values', () => {
  const detail = read('src/routes/strategies.$id.tsx');
  const monitorModule = read('src/components/DemoMonitoringCard.tsx');
  assert(detail.includes('<DemoMonitoringCard'), 'real detail must render the demo monitoring module');
  assert(monitorModule.includes("'monitor.statusNotConnected'"), 'module must expose a not_connected state');
  assert(monitorModule.includes('detail.monitorLegend'), 'monitoring legend must distinguish backtest vs demo vs verified');
  assert(
    !monitorModule.includes('localStorage') && !monitorModule.includes('sessionStorage'),
    'module must not persist anything client-side',
  );
  for (const s of publicStrategies) {
    assert(!('balance' in (s.equity ?? {})), `${s.id} must not carry invented balance`);
    assert(!('monitor' in s), `${s.id} must not carry invented monitoring data`);
  }
});

// 11. Early access never persists data and never claims it saved anything.
test('early access CTA never persists data and makes no false claim', () => {
  const detail = read('src/routes/strategies.$id.tsx');
  const i18n = read('src/i18n/index.ts');
  assert(!detail.includes('localStorage'), 'early access flow must not use localStorage');
  assert(!detail.includes('sessionStorage'), 'early access flow must not use sessionStorage');
  assert(!detail.includes('NotifyDialog'), 'disposable dialog must be gone');
  assert(detail.includes('detail.getAccessUpdates'), 'detail uses the account-based early access CTA');
  assert(i18n.includes('Nothing is collected on this page'), 'early access copy states nothing is collected');
});

// 12. Manifests and metrics are unchanged by QNT-0011.
test('metrics in catalog match manifest results (no metric changes)', () => {
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
        assert(metrics[key] === value, `metric "${key}" changed for ${id} (${metrics[key]} vs ${value})`);
      }
    }
  }
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
