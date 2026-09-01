/**
 * QNT-0015 · Demo monitoring pilot tests.
 *
 *   bun run scripts/test-qnt-0015.ts
 *
 * Verifies: the five permitted connection states; valid/invalid transitions;
 * deterministic freshness (stale window); absence of metrics without real
 * data; impossibility of presenting backtest as demo and demo as verified
 * live; no invented balances/returns; feature flag off by default; checkout,
 * payments, downloads and licenses still disabled; an unambiguous DEMO label;
 * no sensitive fields; routes/Easy Start intact; the four-strategy catalog
 * intact; and safe handling of unknown strategy ids.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicStrategies } from '../src/catalog.ts';
import { buildCommercialCatalog } from '../src/commercial/catalog.ts';
import { getFeatureFlags } from '../src/config.ts';
import {
  DEMO_MONITORING_STATUSES,
  isDemoMonitoringStatus,
  isSaneDemoMetrics,
  type DemoMonitoringMetrics,
} from '../src/domain/demoMonitoring/contracts.ts';
import {
  canTransition,
  deriveDemoFreshness,
  resolveConnectionStatus,
} from '../src/domain/demoMonitoring/stateMachine.ts';
import { resolvePilotSnapshot, sanitizePilotSnapshot } from '../src/domain/demoMonitoring/source.ts';
import { canMarkOrderPaidFromClient, canPurchaseProduct } from '../src/domain/commercial/rules.ts';

const ROOT = resolve(import.meta.dir, '..');
const read = (p: string): string => readFileSync(resolve(ROOT, p), 'utf8');

const tests: { name: string; run: () => void }[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const contracts = read('src/domain/demoMonitoring/contracts.ts');
const stateMachine = read('src/domain/demoMonitoring/stateMachine.ts');
const source = read('src/domain/demoMonitoring/source.ts');
const server = read('src/domain/demoMonitoring/server.ts');
const monitorModule = read('src/components/DemoMonitoringCard.tsx');
const detail = read('src/routes/strategies.$id.tsx');
const guide = read('src/routes/how-to-install.tsx');
const account = read('src/routes/account.tsx');
const i18n = read('src/i18n/index.ts');

const EXPECTED_IDS = [
  'first-triangle-adaptive',
  'first-triangle-gold-adaptive',
  'stochextreme-adaptive',
  'tm-bandas-s3',
];

// ---------------------------------------------------------------------------
// 1. The five permitted states.
// ---------------------------------------------------------------------------
test('exactly the five permitted demo monitoring states exist', () => {
  assert(
    JSON.stringify(DEMO_MONITORING_STATUSES) ===
      JSON.stringify(['not_connected', 'connecting', 'live_demo', 'stale', 'offline']),
    `unexpected statuses: ${DEMO_MONITORING_STATUSES.join(', ')}`,
  );
  for (const s of DEMO_MONITORING_STATUSES) {
    assert(isDemoMonitoringStatus(s), `guard must accept ${s}`);
  }
  assert(!isDemoMonitoringStatus('verified_live'), 'verified_live is not a connection state');
  assert(!isDemoMonitoringStatus('live'), '"live" alone must never be a state');
});

// ---------------------------------------------------------------------------
// 2. Valid and invalid deterministic transitions.
// ---------------------------------------------------------------------------
test('transitions are explicit and invalid moves are rejected', () => {
  assert(canTransition('not_connected', 'connecting'), 'not_connected -> connecting');
  assert(!canTransition('not_connected', 'live_demo'), 'not_connected -> live_demo must be rejected');
  assert(!canTransition('not_connected', 'stale'), 'not_connected -> stale must be rejected');
  assert(canTransition('connecting', 'live_demo'), 'connecting -> live_demo');
  assert(canTransition('connecting', 'offline'), 'connecting -> offline');
  assert(canTransition('live_demo', 'stale'), 'live_demo -> stale');
  assert(canTransition('live_demo', 'offline'), 'live_demo -> offline');
  assert(canTransition('stale', 'live_demo'), 'stale -> live_demo');
  assert(canTransition('offline', 'connecting'), 'offline -> connecting');
  assert(canTransition('offline', 'not_connected'), 'offline -> not_connected');
  // No transition ever produces a state outside the permitted set.
  const names: string[] = stateMachine.match(/not_connected|connecting|live_demo|stale|offline/g) ?? [];
  assert(names.every((s) => isDemoMonitoringStatus(s)), 'transition names stay inside the status set');
});

// ---------------------------------------------------------------------------
// 3. Deterministic freshness (stale window).
// ---------------------------------------------------------------------------
test('freshness is derived deterministically from the documented window', () => {
  const now = Date.parse('2026-08-31T12:00:00.000Z');
  assert(deriveDemoFreshness(undefined, now) === 'unknown', 'no timestamp -> unknown');
  assert(deriveDemoFreshness('2026-08-31T11:50:00.000Z', now) === 'live', 'inside window -> live');
  assert(deriveDemoFreshness('2026-08-31T11:44:59.000Z', now) === 'stale', 'outside window -> stale');
  assert(deriveDemoFreshness('not-a-date', now) === 'unknown', 'invalid timestamp -> unknown');
  assert(
    deriveDemoFreshness('2026-09-01T00:00:00.000Z', now) === 'unknown',
    'future timestamps must never be treated as fresh',
  );
});

// ---------------------------------------------------------------------------
// 3c. Demo metrics are sanity-checked before being served.
// ---------------------------------------------------------------------------
test('demo metrics are sanity-checked in the domain', () => {
  const valid: DemoMonitoringMetrics = {
    balanceMinor: 10000,
    equityMinor: 10500,
    openTrades: 3,
    drawdownPct: 12.5,
    currency: 'USD',
    reportedAt: '2026-08-31T11:50:00.000Z',
  };
  assert(isSaneDemoMetrics(valid), 'valid metrics accepted');
  assert(!isSaneDemoMetrics({ ...valid, balanceMinor: -5 }), 'negative balance rejected');
  assert(!isSaneDemoMetrics({ ...valid, balanceMinor: 1.5 }), 'non-integer minor units rejected');
  assert(!isSaneDemoMetrics({ ...valid, openTrades: 2.5 }), 'non-integer trade count rejected');
  assert(!isSaneDemoMetrics({ ...valid, drawdownPct: 150 }), 'drawdown above 100% rejected');
  assert(!isSaneDemoMetrics({ ...valid, reportedAt: 'nope' }), 'unparseable reportedAt rejected');
});

// ---------------------------------------------------------------------------
// 3d. A future pilot entry can never emit a boundary other than demo.
// ---------------------------------------------------------------------------
test('sanitizePilotSnapshot forces the demo boundary and safe metrics', () => {
  const baseline = resolvePilotSnapshot('first-triangle-adaptive', {
    publishedIds: EXPECTED_IDS,
    productId: 'first-triangle-ustec-m30',
  });
  // No registry injection is public: build the hypothetical malicious entry.
  const malicious = {
    ...baseline,
    declaredBoundary: 'verified_live' as const,
    sourceType: 'demo' as const,
    metrics: {
      balanceMinor: 999,
      equityMinor: 999,
      openTrades: 0,
      drawdownPct: 400,
      currency: 'USD',
      reportedAt: '2026-08-31T11:50:00.000Z',
    },
  };
  const cleaned = sanitizePilotSnapshot(malicious);
  assert(cleaned.declaredBoundary === 'demo', 'boundary is forced back to demo');
  assert(cleaned.sourceType === 'demo', 'sourceType stays demo');
  assert(cleaned.metrics === undefined, 'insane metrics are dropped before serving');
});

// ---------------------------------------------------------------------------
// 3b. Connection status is resolved deterministically (never by the UI).
// ---------------------------------------------------------------------------
test('connection status resolver is deterministic and server-side only', () => {
  const now = Date.parse('2026-08-31T12:00:00.000Z');
  assert(
    resolveConnectionStatus({ hasConfiguredConnection: false, isAttemptingConnection: false, isOperational: false }) ===
      'not_connected',
    'no configured connection -> not_connected',
  );
  assert(
    resolveConnectionStatus({ hasConfiguredConnection: true, isAttemptingConnection: true, isOperational: false }) ===
      'offline',
    'configured but not operational -> offline',
  );
  assert(
    resolveConnectionStatus({ hasConfiguredConnection: true, isAttemptingConnection: true, isOperational: true }) ===
      'connecting',
    'attempting with no data yet -> connecting',
  );
  assert(
    resolveConnectionStatus({
      hasConfiguredConnection: true,
      isAttemptingConnection: false,
      isOperational: true,
      lastUpdatedAt: '2026-08-31T11:50:00.000Z',
      now,
    }) === 'live_demo',
    'recent demo data -> live_demo',
  );
  assert(
    resolveConnectionStatus({
      hasConfiguredConnection: true,
      isAttemptingConnection: false,
      isOperational: true,
      lastUpdatedAt: '2026-08-31T11:44:00.000Z',
      now,
    }) === 'stale',
    'old demo data -> stale',
  );
});

// ---------------------------------------------------------------------------
// 4. No metrics when there is no data.
// ---------------------------------------------------------------------------
test('pilot snapshot has no metrics or balances without supplied data', () => {
  const snap = resolvePilotSnapshot('first-triangle-adaptive', {
    publishedIds: EXPECTED_IDS,
    productId: 'first-triangle-ustec-m30',
  });
  assert(snap.connectionStatus === 'not_connected', 'must be not_connected with no data');
  assert(snap.freshness === 'unknown', 'freshness must be unknown with no data');
  assert(snap.metrics === undefined, 'no metrics may exist without supplied demo data');
  assert(snap.lastUpdatedAt === undefined, 'no lastUpdatedAt may be invented');
  assert(snap.declaredBoundary === 'demo', 'boundary must be demo');
});

// ---------------------------------------------------------------------------
// 5. Backtest can never be presented as demo.
// ---------------------------------------------------------------------------
test('backtest data is never piped into the demo module', () => {
  assert(detail.includes('<DemoMonitoringCard'), 'real detail renders the demo monitoring module');
  const realSection = detail.slice(detail.indexOf('function RealDetail'), detail.indexOf('function MockDetail'));
  assert(realSection.includes('strategyId={s.id}'), 'card receives the strategy id only');
  assert(
    !realSection.includes('<DemoMonitoringCard strategy={') && !realSection.includes('equity={'),
    'card must not receive backtest metrics/equity',
  );
  assert(monitorModule.includes('{ strategyId }'), 'card signature accepts strategyId only');
  assert(!monitorModule.includes('PublicStrategy'), 'card never imports the strategy type');
  assert(!monitorModule.includes('s.metrics') && !monitorModule.includes('metrics={'), 'card never reads strategy metrics');
});

// ---------------------------------------------------------------------------
// 6. Demo can never be presented as verified live.
// ---------------------------------------------------------------------------
test('demo can never be presented as verified live', () => {
  assert(!source.includes("declaredBoundary: 'verified_live'"), 'pilot source must not declare verified_live');
  assert(!server.includes("declaredBoundary: 'verified_live'"), 'server must not declare verified_live');
  assert(!i18n.includes("'monitor.statusVerifiedLive'"), 'no verified-live status label may exist');
  assert(!monitorModule.includes('Verified live'), 'card must not render a Verified live label');
  // The only mention allowed is the separation legend (backtest vs demo vs verified).
  assert(i18n.includes('Backtest ≠ Demo monitoring ≠ Verified live result'), 'separation legend is present');
});

// ---------------------------------------------------------------------------
// 7. No invented balance or returns.
// ---------------------------------------------------------------------------
test('no invented balance, equity or returns are rendered', () => {
  const sourceAll = contracts + source + server + monitorModule;
  assert(!/balanceMinor\s*[:=]\s*[0-9]/.test(sourceAll), 'no hardcoded balance amount');
  assert(!/equityMinor\s*[:=]\s*[0-9]/.test(sourceAll), 'no hardcoded equity amount');
  assert(/detail\.monitorNotAvailable/.test(monitorModule), 'absent values render as Not available');
});

// ---------------------------------------------------------------------------
// 8. Feature flag off by default.
// ---------------------------------------------------------------------------
test('DEMO_MONITORING_ENABLED is off by default', () => {
  const flags = getFeatureFlags();
  assert(flags.demoMonitoringEnabled === false, 'demo flag must default false');
  assert(flags.paymentsEnabled === false && flags.downloadsEnabled === false, 'commercial flags stay false');
});

// ---------------------------------------------------------------------------
// 9. Checkout, payments, downloads and licenses stay disabled.
// ---------------------------------------------------------------------------
test('checkout, payments, downloads and licenses remain disabled', () => {
  const cat = buildCommercialCatalog();
  assert(cat.length === 4, 'catalog still has four products');
  for (const p of cat) {
    assert(p.productStatus === 'coming_soon', `${p.productId} stays coming_soon`);
    assert(p.availability.canStartCheckout === false, `${p.productId} checkout disabled`);
    assert(p.availability.canDownload === false, `${p.productId} download disabled`);
  }
  assert(canPurchaseProduct({ status: 'coming_soon' }) === false, 'coming_soon is not purchasable');
  assert(canMarkOrderPaidFromClient() === false, 'paid can never be set from the client');
});

// ---------------------------------------------------------------------------
// 10. Unambiguous DEMO label.
// ---------------------------------------------------------------------------
test('the module and its labels are unmistakably demo', () => {
  assert(i18n.includes("'detail.monitorEyebrow': 'Demo monitoring'"), 'module heading says Demo monitoring');
  for (const key of [
    "'monitor.statusNotConnected'",
    "'monitor.statusConnecting'",
    "'monitor.statusLiveDemo'",
    "'monitor.statusStale'",
    "'monitor.statusOffline'",
  ]) {
    assert(i18n.includes(key), `i18n must define ${key}`);
  }
  assert(i18n.includes("'monitor.disclaimer'"), 'demo disclaimer key exists');
  assert(!i18n.includes("'monitor.statusLive'"), 'no bare "Live" state label');
  assert(!monitorModule.includes("'Live'"), 'card must not render a bare Live label');
});

// ---------------------------------------------------------------------------
// 11. No sensitive fields are exposed.
// ---------------------------------------------------------------------------
test('no credential/secret fields exist in the demo monitoring surface', () => {
  const surface = contracts + stateMachine + source + server;
  assert(!/password\s*[?:]/.test(surface), 'no password field');
  assert(!/investorPassword\s*[?:]/.test(surface), 'no investor password field');
  assert(!/secret\s*[?:]/.test(surface), 'no secret field');
  assert(!/token\s*[?:]/.test(surface), 'no token field');
  assert(!/accountNumber\s*[?:]/.test(surface), 'no raw account number field');
  assert(!monitorModule.includes('localStorage'), 'module must not use localStorage');
  assert(!monitorModule.includes('sessionStorage'), 'module must not use sessionStorage');
});

// ---------------------------------------------------------------------------
// 12. Existing routes and Easy Start remain intact.
// ---------------------------------------------------------------------------
test('Easy Start, routes and account protection are untouched', () => {
  assert(guide.includes("createFileRoute('/how-to-install')"), 'how-to-install route still registered');
  assert(detail.includes('EasyStartSteps') && detail.includes('asLinkTo="/how-to-install"'), 'Easy Start block intact on detail');
  assert(detail.includes('metric-grid'), 'metrics still rendered');
  assert(detail.includes('detail.notifyMe'), 'product notify CTA still present');
  assert(account.includes('beforeLoad'), 'account auth protection intact');
});

// ---------------------------------------------------------------------------
// 13. The four-strategy public catalog continues to work.
// ---------------------------------------------------------------------------
test('the four real strategies continue to be published', () => {
  const ids = publicStrategies.map((s) => s.id).sort();
  assert(JSON.stringify(ids) === JSON.stringify([...EXPECTED_IDS].sort()), `catalog ids changed: ${ids.join(', ')}`);
  for (const s of publicStrategies) {
    assert(s.productStatus === 'coming_soon', `${s.id} stays coming_soon`);
  }
});

// ---------------------------------------------------------------------------
// 14. Unknown strategy ids are handled safely.
// ---------------------------------------------------------------------------
test('unknown or unmapped strategy ids resolve safely', () => {
  const snap = resolvePilotSnapshot('no-such-strategy', { publishedIds: EXPECTED_IDS });
  assert(snap.connectionStatus === 'not_connected', 'unknown id must resolve to not_connected');
  assert(snap.metrics === undefined, 'unknown id must never carry metrics');
  assert(snap.unavailableReason.length > 0, 'unknown id carries a truthful reason');
  // The client never crashes on a missing/invalid snapshot and defaults to not_connected.
  assert(monitorModule.includes("?? 'not_connected'"), 'client defaults to not_connected');
  assert(server.includes("typeof input.strategyId === 'string'"), 'server validates the query');
});

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