/**
 * QNT-0002F isolated validation tests.
 *
 * Runs with no third-party dependencies:
 *   bun scripts/test-validation.ts
 * or, equivalently on Node >= 22.6:
 *   node --experimental-strip-types scripts/test-validation.ts
 *
 * Exits with a non-zero code (via an uncaught throw) when any assertion fails,
 * and prints the total number of tests executed.
 */
import { validateDataset, type ValidationIssue } from '../src/domain/validation.ts';

const PROV = { dataStatus: 'mock', sourceName: 'Synthetic fixture', sourceType: 'fixture' } as const;
const REAL_PROV = { dataStatus: 'real', sourceName: 'Owner delivery', sourceType: 'owner-delivery' } as const;

function strategy(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    name: 'Strategy ' + id,
    version: '1.0.0',
    status: 'active',
    validationStatus: 'mock',
    assetIds: [],
    backtestIds: [],
    provenance: { ...PROV },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
    ...extra,
  };
}

function asset(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, symbol: 'SYM', name: 'Asset ' + id, assetClass: 'other', ...extra };
}

function backtest(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    strategyId: 'strat-1',
    assetIds: [],
    startedAt: '2025-01-01T00:00:00Z',
    endedAt: '2025-01-02T00:00:00Z',
    timeframe: 'H1',
    initialCapital: 10000,
    currency: 'USD',
    metrics: {},
    tradeLogIds: [],
    provenance: { ...PROV },
    ...extra,
  };
}

function curve(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    strategyId: 'strat-1',
    backtestId: 'bt-1',
    currency: 'USD',
    points: [{ timestamp: '2025-01-01T00:00:00Z', equity: 10000 }],
    provenance: { ...PROV },
    ...extra,
  };
}

function trade(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    backtestId: 'bt-1',
    strategyId: 'strat-1',
    assetId: 'asset-1',
    side: 'buy',
    openedAt: '2025-01-01T01:00:00Z',
    quantity: 1,
    entryPrice: 100,
    currency: 'USD',
    provenance: { ...PROV },
    ...extra,
  };
}

function dataset(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    modelVersion: '1.0',
    strategies: [],
    assets: [],
    backtests: [],
    equityCurves: [],
    tradeLogs: [],
    ...overrides,
  };
}

function fullValidDataset(): Record<string, unknown> {
  return dataset({
    strategies: [strategy('strat-1', { assetIds: ['asset-1'], backtestIds: ['bt-1'] })],
    assets: [asset('asset-1')],
    backtests: [backtest('bt-1', { strategyId: 'strat-1', assetIds: ['asset-1'], equityCurveId: 'curve-1', tradeLogIds: ['trade-1'] })],
    equityCurves: [curve('curve-1', { strategyId: 'strat-1', backtestId: 'bt-1' })],
    tradeLogs: [trade('trade-1', { backtestId: 'bt-1', strategyId: 'strat-1', assetId: 'asset-1' })],
  });
}

function oneStrategy(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return dataset({ strategies: [strategy('strat-1', extra)] });
}

function oneBacktest(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return dataset({ strategies: [strategy('strat-1')], backtests: [backtest('bt-1', extra)] });
}

const tests: { name: string; run: () => void }[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function issuesOf(value: unknown): ValidationIssue[] {
  return validateDataset(value);
}

function fmt(issues: ValidationIssue[]): string {
  return issues.length ? issues.map((i) => `${i.path}: ${i.message}`).join(' | ') : '(none)';
}

function expectValid(value: unknown): void {
  const issues = issuesOf(value);
  if (issues.length > 0) throw new Error(`expected no issues, got: ${fmt(issues)}`);
}

function expectIssue(value: unknown, path: string): void {
  const issues = issuesOf(value);
  if (!issues.some((i) => i.path === path)) {
    throw new Error(`expected issue at "${path}", got: ${fmt(issues)}`);
  }
}

function expectIssues(value: unknown, paths: string[]): void {
  const issues = issuesOf(value);
  for (const path of paths) {
    if (!issues.some((i) => i.path === path)) {
      throw new Error(`expected issue at "${path}", got: ${fmt(issues)}`);
    }
  }
}

// 1. Complete valid dataset
test('1. complete valid dataset', () => expectValid(fullValidDataset()));

// 2. Root is not an object
test('2. root is not an object', () => {
  for (const value of [null, undefined, 'text', 42, true, [1, 2, 3]]) {
    const issues = issuesOf(value);
    if (issues.length !== 1 || issues[0]!.path !== '') {
      throw new Error(`expected single root issue for ${String(value)}, got: ${fmt(issues)}`);
    }
  }
});

// 3. Invalid modelVersion
test('3. invalid modelVersion', () => expectIssue(dataset({ modelVersion: '2.0' }), 'modelVersion'));

// 4. Five missing collections
test('4. five missing collections', () =>
  expectIssues({ modelVersion: '1.0' }, ['strategies', 'assets', 'backtests', 'equityCurves', 'tradeLogs']));

// 5. Five non-array collections simultaneously
test('5. five non-array collections', () =>
  expectIssues(
    dataset({ strategies: {}, assets: 1, backtests: 'x', equityCurves: null, tradeLogs: true }),
    ['strategies', 'assets', 'backtests', 'equityCurves', 'tradeLogs'],
  ));

// 6. No input mutation
test('6. validateDataset does not mutate input', () => {
  const ds = fullValidDataset();
  const before = JSON.stringify(ds);
  validateDataset(ds);
  if (JSON.stringify(ds) !== before) throw new Error('input was mutated');
});

// 7-11. Unsafe collection elements never throw
test('7. strategies: [null]', () => expectIssue(dataset({ strategies: [null] }), 'strategies[0]'));
test('8. assets: [123]', () => expectIssue(dataset({ assets: [123] }), 'assets[0]'));
test('9. backtests: ["invalid"]', () => expectIssue(dataset({ backtests: ['invalid'] }), 'backtests[0]'));
test('10. equityCurves: [null]', () => expectIssue(dataset({ equityCurves: [null] }), 'equityCurves[0]'));
test('11. tradeLogs: [false]', () => expectIssue(dataset({ tradeLogs: [false] }), 'tradeLogs[0]'));

// 12. Duplicate global id
test('12. duplicate global id', () => expectIssue(dataset({ assets: [asset('a'), asset('a')] }), 'assets[1].id'));

// 13. Missing required id
test('13. missing required id', () => expectIssue(dataset({ assets: [asset('')] }), 'assets[0].id'));

// 14. Wrong field type
test('14. wrong field type', () => expectIssue(dataset({ strategies: [strategy('s', { name: 123 })] }), 'strategies[0].name'));

// 15. Invalid enum
test('15. invalid enum', () => expectIssue(dataset({ assets: [asset('a', { assetClass: 'bogus' })] }), 'assets[0].assetClass'));

// 16. Impossible calendar date
test('16. impossible calendar date', () =>
  expectIssue(dataset({ strategies: [strategy('s', { createdAt: '2025-02-30T10:00:00Z' })] }), 'strategies[0].createdAt'));

// 17. Invalid offsets
test('17. invalid offsets', () => {
  for (const bad of [
    '2025-01-01T10:00:00+24:00',
    '2025-01-01T10:00:00+02:60',
    '2025-01-01T10:00:00+99:99',
    '2025-01-01T25:00:00Z',
    '2025-01-01T10:60:00Z',
    '2025-01-01T10:00:60Z',
    '2025-01-01T10:00:00',
    '2025-13-01T10:00:00Z',
  ]) {
    expectIssue(dataset({ strategies: [strategy('s', { createdAt: bad })] }), 'strategies[0].createdAt');
  }
});

// 18. Valid dates and offsets
test('18. valid dates and offsets', () => {
  for (const good of [
    '2025-01-01T10:00:00Z',
    '2025-01-01T10:00:00.123Z',
    '2025-01-01T10:00:00+02:00',
    '2025-01-01T10:00:00-05:00',
    '2024-02-29T10:00:00Z',
  ]) {
    expectValid(dataset({ strategies: [strategy('s', { createdAt: good, updatedAt: '2025-01-02T00:00:00Z' })] }));
  }
});

// 19-24. Metrics
test('19. metrics null', () => expectIssue(oneBacktest({ metrics: null }), 'backtests[0].metrics'));
test('20. metrics array', () => expectIssue(oneBacktest({ metrics: [] }), 'backtests[0].metrics'));
test('21. metrics string', () => expectIssue(oneBacktest({ metrics: 'invalid' }), 'backtests[0].metrics'));
test('22. non-numeric metric', () => expectIssue(oneBacktest({ metrics: { winRate: '80%' } }), 'backtests[0].metrics.winRate'));
test('23. NaN metric', () => expectIssue(oneBacktest({ metrics: { profitFactor: NaN } }), 'backtests[0].metrics.profitFactor'));
test('24. Infinity metric', () => expectIssue(oneBacktest({ metrics: { value: Infinity } }), 'backtests[0].metrics.value'));

// 25-27. Provenance
test('25. provenance null', () => expectIssue(oneStrategy({ provenance: null }), 'strategies[0].provenance'));
test('26. provenance array', () => expectIssue(oneStrategy({ provenance: [] }), 'strategies[0].provenance'));
test('27. invalid sourceType', () =>
  expectIssue(
    oneStrategy({ provenance: { dataStatus: 'mock', sourceName: 'x', sourceType: 'bogus' } }),
    'strategies[0].provenance.sourceType',
  ));

// 28-39. Referential integrity
test('28. nonexistent asset', () =>
  expectIssue(dataset({ strategies: [strategy('strat-1', { assetIds: ['missing'] })] }), 'strategies[0].assetIds'));

test('29. nonexistent backtest', () =>
  expectIssue(dataset({ strategies: [strategy('strat-1', { backtestIds: ['missing'] })] }), 'strategies[0].backtestIds'));

test('30. nonexistent equity curve', () => expectIssue(oneBacktest({ equityCurveId: 'missing' }), 'backtests[0].equityCurveId'));

test('31. curve of another backtest', () =>
  expectIssue(
    dataset({
      strategies: [strategy('strat-1', { backtestIds: ['bt-1', 'bt-2'] })],
      backtests: [backtest('bt-1', { equityCurveId: 'curve-1' }), backtest('bt-2', {})],
      equityCurves: [curve('curve-1', { backtestId: 'bt-2', strategyId: 'strat-1' })],
    }),
    'equityCurves[0].backtestId',
  ));

test('32. curve of another strategy', () =>
  expectIssue(
    dataset({
      strategies: [strategy('strat-1', { backtestIds: ['bt-1'] }), strategy('strat-2')],
      backtests: [backtest('bt-1', { strategyId: 'strat-1', equityCurveId: 'curve-1' })],
      equityCurves: [curve('curve-1', { backtestId: 'bt-1', strategyId: 'strat-2' })],
    }),
    'equityCurves[0].strategyId',
  ));

test('33. curve without back-reference', () =>
  expectIssue(
    dataset({
      strategies: [strategy('strat-1', { backtestIds: ['bt-1'] })],
      backtests: [backtest('bt-1', {})],
      equityCurves: [curve('curve-1', { backtestId: 'bt-1', strategyId: 'strat-1' })],
    }),
    'equityCurves[0].backtestId',
  ));

test('34. nonexistent trade', () => expectIssue(oneBacktest({ tradeLogIds: ['missing'] }), 'backtests[0].tradeLogIds'));

test('35. trade of another backtest', () =>
  expectIssue(
    dataset({
      strategies: [strategy('strat-1', { assetIds: ['asset-1'], backtestIds: ['bt-1', 'bt-2'] })],
      assets: [asset('asset-1')],
      backtests: [backtest('bt-1', { assetIds: ['asset-1'], tradeLogIds: ['trade-1'] }), backtest('bt-2', { assetIds: ['asset-1'] })],
      tradeLogs: [trade('trade-1', { backtestId: 'bt-2', strategyId: 'strat-1', assetId: 'asset-1' })],
    }),
    'backtests[0].tradeLogIds',
  ));

test('36. trade of another strategy', () =>
  expectIssue(
    dataset({
      strategies: [strategy('strat-1', { assetIds: ['asset-1'], backtestIds: ['bt-1'] }), strategy('strat-2', { assetIds: ['asset-1'] })],
      assets: [asset('asset-1')],
      backtests: [backtest('bt-1', { assetIds: ['asset-1'], tradeLogIds: ['trade-1'] })],
      tradeLogs: [trade('trade-1', { strategyId: 'strat-2', backtestId: 'bt-1', assetId: 'asset-1' })],
    }),
    'backtests[0].tradeLogIds',
  ));

test('37. trade not listed by backtest', () =>
  expectIssue(
    dataset({
      strategies: [strategy('strat-1', { assetIds: ['asset-1'], backtestIds: ['bt-1'] })],
      assets: [asset('asset-1')],
      backtests: [backtest('bt-1', { assetIds: ['asset-1'], tradeLogIds: [] })],
      tradeLogs: [trade('trade-1', { backtestId: 'bt-1', strategyId: 'strat-1', assetId: 'asset-1' })],
    }),
    'tradeLogs[0].id',
  ));

test('38. trade asset not in backtest', () =>
  expectIssue(
    dataset({
      strategies: [strategy('strat-1', { assetIds: ['asset-1', 'asset-2'], backtestIds: ['bt-1'] })],
      assets: [asset('asset-1'), asset('asset-2')],
      backtests: [backtest('bt-1', { assetIds: ['asset-1'], tradeLogIds: ['trade-1'] })],
      tradeLogs: [trade('trade-1', { assetId: 'asset-2', backtestId: 'bt-1', strategyId: 'strat-1' })],
    }),
    'tradeLogs[0].assetId',
  ));

test('39. trade asset not in strategy', () =>
  expectIssue(
    dataset({
      strategies: [strategy('strat-1', { assetIds: ['asset-1'], backtestIds: ['bt-1'] })],
      assets: [asset('asset-1'), asset('asset-2')],
      backtests: [backtest('bt-1', { assetIds: ['asset-2'], tradeLogIds: ['trade-1'] })],
      tradeLogs: [trade('trade-1', { assetId: 'asset-2', backtestId: 'bt-1', strategyId: 'strat-1' })],
    }),
    'tradeLogs[0].assetId',
  ));

// 40-46. provenance × validationStatus matrix
test('40. mock + mock valid', () => expectValid(dataset({ strategies: [strategy('s')] })));
test('41. real + owner_supplied_under_review valid', () =>
  expectValid(oneStrategy({ validationStatus: 'owner_supplied_under_review', provenance: { ...REAL_PROV } })));
test('42. real + quantora_validated valid', () =>
  expectValid(oneStrategy({ validationStatus: 'quantora_validated', provenance: { ...REAL_PROV } })));
test('43. real + rejected valid', () =>
  expectValid(oneStrategy({ validationStatus: 'rejected', provenance: { ...REAL_PROV } })));
test('44. real + mock invalid', () =>
  expectIssue(oneStrategy({ validationStatus: 'mock', provenance: { ...REAL_PROV } }), 'strategies[0].validationStatus'));
test('45. mock + owner_supplied_under_review invalid', () =>
  expectIssue(oneStrategy({ validationStatus: 'owner_supplied_under_review', provenance: { ...PROV } }), 'strategies[0].validationStatus'));
test('46. validationStatus absent', () =>
  expectIssue(oneStrategy({ validationStatus: undefined }), 'strategies[0].validationStatus'));

// 47. Valid dataset without curve
test('47. valid dataset without curve', () =>
  expectValid(
    dataset({
      strategies: [strategy('strat-1', { assetIds: ['asset-1'], backtestIds: ['bt-1'] })],
      assets: [asset('asset-1')],
      backtests: [backtest('bt-1', { strategyId: 'strat-1', assetIds: ['asset-1'], tradeLogIds: ['trade-1'] })],
      equityCurves: [],
      tradeLogs: [trade('trade-1', { backtestId: 'bt-1', strategyId: 'strat-1', assetId: 'asset-1' })],
    }),
  ));

// 48. Valid dataset without trades (tradeLogIds: [])
test('48. valid dataset without trades', () =>
  expectValid(
    dataset({
      strategies: [strategy('strat-1', { assetIds: ['asset-1'], backtestIds: ['bt-1'] })],
      assets: [asset('asset-1')],
      backtests: [backtest('bt-1', { strategyId: 'strat-1', assetIds: ['asset-1'], tradeLogIds: [], equityCurveId: 'curve-1' })],
      equityCurves: [curve('curve-1', { strategyId: 'strat-1', backtestId: 'bt-1' })],
      tradeLogs: [],
    }),
  ));

// 49. Absent metric values accepted (metrics: {})
test('49. absent metric values accepted', () => expectValid(oneBacktest({ metrics: {} })));

// 50. Empty required arrays accepted
test('50. empty required arrays accepted', () => expectValid(dataset({})));

// 51-54. receivedAt offset boundary (max ±14:00)
test('51. receivedAt +14:00 valid', () =>
  expectValid(oneStrategy({ provenance: { dataStatus: 'mock', sourceName: 'x', sourceType: 'fixture', receivedAt: '2025-01-01T10:00:00+14:00' } })));
test('52. receivedAt +14:01 invalid', () =>
  expectIssue(oneStrategy({ provenance: { dataStatus: 'mock', sourceName: 'x', sourceType: 'fixture', receivedAt: '2025-01-01T10:00:00+14:01' } }), 'strategies[0].provenance.receivedAt'));
test('53. receivedAt +15:00 invalid', () =>
  expectIssue(oneStrategy({ provenance: { dataStatus: 'mock', sourceName: 'x', sourceType: 'fixture', receivedAt: '2025-01-01T10:00:00+15:00' } }), 'strategies[0].provenance.receivedAt'));
test('54. receivedAt without zone invalid', () =>
  expectIssue(oneStrategy({ provenance: { dataStatus: 'mock', sourceName: 'x', sourceType: 'fixture', receivedAt: '2025-01-01T10:00:00' } }), 'strategies[0].provenance.receivedAt'));

// 55-57. Temporal coherence
test('55. createdAt after updatedAt invalid', () =>
  expectIssue(dataset({ strategies: [strategy('s', { createdAt: '2025-01-02T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' })] }), 'strategies[0].updatedAt'));
test('56. startedAt after endedAt invalid', () =>
  expectIssue(oneBacktest({ startedAt: '2025-01-02T00:00:00Z', endedAt: '2025-01-01T00:00:00Z' }), 'backtests[0].endedAt'));
test('57. openedAt after closedAt invalid', () =>
  expectIssue(
    dataset({
      strategies: [strategy('strat-1', { assetIds: ['asset-1'], backtestIds: ['bt-1'] })],
      assets: [asset('asset-1')],
      backtests: [backtest('bt-1', { assetIds: ['asset-1'], tradeLogIds: ['trade-1'] })],
      tradeLogs: [trade('trade-1', { openedAt: '2025-01-02T00:00:00Z', closedAt: '2025-01-01T00:00:00Z' })],
    }),
    'tradeLogs[0].closedAt',
  ));

// 58. Invalid id does not hide other structural errors
test('58. invalid id does not hide other errors', () =>
  expectIssues(dataset({ assets: [{ symbol: 'S', assetClass: 'other' }] }), ['assets[0].id', 'assets[0].name']));

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
