/**
 * QNT-0003 strategy intake pipeline tests.
 *
 * Runs with no third-party dependencies:
 *   bun scripts/test-strategy-intake.ts
 *
 * Exits non-zero (uncaught throw) when any assertion fails and prints the total
 * number of tests executed.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { strategies as mockStrategies } from '../src/data.ts';
import { evaluatePublishFilter } from './intake/filter.ts';
import { buildFirstTriangleManifest, MANIFEST_PATH } from './intake/ingest-first-triangle.ts';
import { validateManifest } from './intake/manifest.ts';
import {
  buildCatalog,
  buildPublicCatalog,
  discoverManifests,
  exitCodeFor,
  mockStrategyToCatalogEntry,
  processDirectory,
  processManifest,
  sha256,
  type CatalogEntry,
  type ManifestIssue,
} from './intake/pipeline.ts';

const EXAMPLES_DIR = resolve(process.cwd(), 'strategy-intake/examples');

const MOCK_PROV = { dataStatus: 'mock', sourceName: 'Synthetic fixture', sourceType: 'fixture' } as const;
const REAL_PROV = { dataStatus: 'real', sourceName: 'Synthetic fixture', sourceType: 'owner-delivery' } as const;

function strategy(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    name: 'Strategy ' + id,
    version: '1.0.0',
    status: 'draft',
    validationStatus: 'mock',
    assetIds: [],
    backtestIds: [],
    provenance: { ...MOCK_PROV },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
    ...extra,
  };
}

function makeManifest(
  strategyId: string,
  opts: {
    strategy?: Record<string, unknown>;
    assets?: unknown[];
    backtests?: unknown[];
    equityCurves?: unknown[];
    tradeLogs?: unknown[];
    top?: Record<string, unknown>;
  } = {},
): Record<string, unknown> {
  return {
    manifestVersion: '1.0',
    strategyId,
    tagline: 'tagline',
    type: 'Explorer',
    ...(opts.top ?? {}),
    dataset: {
      modelVersion: '1.0',
      strategies: [strategy(strategyId, opts.strategy ?? {})],
      assets: opts.assets ?? [],
      backtests: opts.backtests ?? [],
      equityCurves: opts.equityCurves ?? [],
      tradeLogs: opts.tradeLogs ?? [],
    },
  };
}

function realStrategy(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return strategy(id, { validationStatus: 'owner_supplied_under_review', provenance: { ...REAL_PROV }, ...extra });
}

function realBacktest(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    strategyId: 'strat-real',
    assetIds: [],
    startedAt: '2025-01-01T00:00:00Z',
    endedAt: '2025-01-02T00:00:00Z',
    timeframe: 'H1',
    initialCapital: 10000,
    currency: 'USD',
    metrics: {},
    tradeLogIds: [],
    provenance: { ...REAL_PROV },
    ...extra,
  };
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'quantora-intake-'));
}

function writeManifest(path: string, value: unknown): string {
  writeFileSync(path, JSON.stringify(value, null, 2));
  return path;
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const tests: { name: string; run: () => void }[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hasError(issues: ManifestIssue[], part: string): boolean {
  return issues.some(
    (issue) => issue.level === 'error' && (issue.path.includes(part) || issue.message.includes(part)),
  );
}

function hasWarning(issues: ManifestIssue[], part: string): boolean {
  return issues.some(
    (issue) => issue.level === 'warning' && (issue.path.includes(part) || issue.message.includes(part)),
  );
}

// 1. Discovery of multiple manifests (deterministic order)
test('discovers multiple manifests deterministically', () => {
  const dir = tempDir();
  try {
    writeManifest(join(dir, 'b.manifest.json'), makeManifest('strat-b'));
    writeManifest(join(dir, 'a.manifest.json'), makeManifest('strat-a'));
    const found = discoverManifests(dir);
    assert(found.length === 2, `expected 2 manifests, got ${found.length}`);
    assert(found[0]!.endsWith('a.manifest.json'), 'expected a.manifest.json first');
    assert(found[1]!.endsWith('b.manifest.json'), 'expected b.manifest.json second');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 2. Valid mock manifest
test('valid mock manifest', () => {
  const dir = tempDir();
  try {
    const path = writeManifest(join(dir, 'mock.manifest.json'), makeManifest('strat-mock'));
    const result = processManifest(path);
    assert(result.issues.length === 0, `expected no issues: ${JSON.stringify(result.issues)}`);
    assert(result.entry?.dataStatus === 'mock', 'expected dataStatus mock');
    assert(result.entry?.validationStatus === 'mock', 'expected validationStatus mock');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 3. Valid real Under Review manifest
test('valid real Under Review manifest', () => {
  const dir = tempDir();
  try {
    const path = writeManifest(join(dir, 'real.manifest.json'), makeManifest('strat-real', { strategy: realStrategy('strat-real') }));
    const result = processManifest(path);
    assert(result.issues.length === 0, `expected no issues: ${JSON.stringify(result.issues)}`);
    assert(result.entry?.dataStatus === 'real', 'expected dataStatus real');
    assert(result.entry?.validationStatus === 'owner_supplied_under_review', 'expected validationStatus owner_supplied_under_review');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 4. Partial documentary manifest (identity + provenance, no results)
test('partial documentary manifest accepted without results', () => {
  const dir = tempDir();
  try {
    const path = writeManifest(join(dir, 'doc.manifest.json'), makeManifest('strat-doc', { strategy: realStrategy('strat-doc') }));
    const result = processManifest(path);
    assert(result.issues.length === 0, `expected no issues: ${JSON.stringify(result.issues)}`);
    assert(hasWarning(result.warnings, 'dataset.backtests'), 'expected documentary warning');
    assert(result.entry?.metrics === undefined, 'metrics must remain absent, not zero');
    assert(result.entry?.period === undefined, 'period must remain absent, not zero');
    assert(result.entry?.equity === undefined, 'equity must remain absent, not fabricated');
    assert(result.entry?.trades === undefined, 'trades must remain absent, not fabricated');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 5. Reject incorrect mock/real combination
test('rejects real data with mock validationStatus', () => {
  const manifest = makeManifest('strat-bad', {
    strategy: { validationStatus: 'mock', provenance: { ...REAL_PROV } },
  });
  const issues = validateManifest(manifest);
  assert(hasError(issues, 'dataset.strategies[0].validationStatus'), `expected validationStatus issue: ${JSON.stringify(issues)}`);
});

// 6. Reject duplicate id (catalog level)
test('rejects duplicate strategy id in catalog', () => {
  const entry: CatalogEntry = { id: 'dup', name: 'Duplicate', assets: [] };
  const result = buildCatalog([], [entry, { ...entry }]);
  assert(hasError(result.issues, 'Duplicate'), `expected duplicate issue: ${JSON.stringify(result.issues)}`);
});

// 7. Reject NaN and Infinity metrics
test('rejects NaN and Infinity metrics', () => {
  for (const bad of [NaN, Infinity]) {
    const manifest = makeManifest('strat-real', {
      strategy: realStrategy('strat-real', { backtestIds: ['bt-1'] }),
      backtests: [realBacktest('bt-1', { metrics: { value: bad } })],
    });
    const issues = validateManifest(manifest);
    assert(hasError(issues, 'dataset.backtests[0].metrics'), `expected metrics issue for ${bad}: ${JSON.stringify(issues)}`);
  }
});

// 8. Absence is distinct from zero (metrics:{} stays absent, not 0)
test('absence is distinct from zero', () => {
  const dir = tempDir();
  try {
    const path = writeManifest(
      join(dir, 'm.manifest.json'),
      makeManifest('strat-real', {
        strategy: realStrategy('strat-real', { backtestIds: ['bt-1'] }),
        backtests: [realBacktest('bt-1', { metrics: {} })],
      }),
    );
    const result = processManifest(path);
    assert(result.issues.length === 0, `expected no issues: ${JSON.stringify(result.issues)}`);
    assert(result.entry?.metrics === undefined, 'empty metrics must map to absent metrics, not zero');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 9. Non-existent equity evidence is not fabricated
test('missing evidence file is a blocking error and equity is not fabricated', () => {
  const dir = tempDir();
  try {
    const manifest = makeManifest('strat-real', {
      strategy: realStrategy('strat-real'),
      top: { evidence: [{ file: 'missing.csv', kind: 'equity', classification: 'private' }] },
    });
    const path = writeManifest(join(dir, 'm.manifest.json'), manifest);
    const result = processManifest(path);
    assert(hasError(result.issues, 'Evidence file not found'), `expected missing evidence issue: ${JSON.stringify(result.issues)}`);
    assert(result.entry === null, 'manifest with blocking evidence error must not produce a catalog entry');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 10. Deterministic hash
test('deterministic sha256 hash', () => {
  assert(
    sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'sha256("abc") mismatch',
  );
  const dir = tempDir();
  try {
    const file = join(dir, 'evidence.txt');
    writeFileSync(file, 'quantora');
    assert(sha256(file) === sha256(file), 'sha256File must be stable');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 11. Private (and forbidden-extension) evidence is never exposed
test('private evidence is exposed by hash only', () => {
  const dir = tempDir();
  try {
    writeFileSync(join(dir, 'rules.mq5'), '// private source placeholder');
    const manifest = makeManifest('strat-real', {
      strategy: realStrategy('strat-real'),
      top: { evidence: [{ file: 'rules.mq5', kind: 'source', classification: 'private' }] },
    });
    const path = writeManifest(join(dir, 'm.manifest.json'), manifest);
    const result = processManifest(path);
    assert(result.issues.length === 0, `expected no issues: ${JSON.stringify(result.issues)}`);
    assert(result.entry?.evidencePublic === undefined, 'private evidence must not be public');
    assert(result.entry?.evidencePrivate?.length === 1, 'expected one private evidence entry');
    assert(result.entry?.evidencePrivate?.[0]?.hash.length === 64, 'expected sha256 hash');
    assert(!('name' in (result.entry?.evidencePrivate?.[0] ?? {})), 'private evidence must not expose name/path');
    assert(JSON.stringify(result.entry).includes('rules.mq5') === false, 'filename must not leak into catalog entry');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 12. Deterministic catalog
test('deterministic catalog', () => {
  const mocks = mockStrategies.map(mockStrategyToCatalogEntry);
  const a = buildCatalog(mocks, []);
  const b = buildCatalog(mocks, []);
  assert(JSON.stringify(a.catalog) === JSON.stringify(b.catalog), 'catalog must be deterministic');
});

// 13. Multiple strategies incorporated without code changes
test('multiple strategies incorporated without code changes', () => {
  const dir = tempDir();
  try {
    writeManifest(join(dir, 'one.manifest.json'), makeManifest('strat-one'));
    writeManifest(join(dir, 'two.manifest.json'), makeManifest('strat-two'));
    const result = processDirectory(dir);
    assert(result.issues.length === 0, `expected no issues: ${JSON.stringify(result.issues)}`);
    const entries = result.manifests.map((m) => m.entry?.id).sort();
    assert(entries.length === 2, `expected 2 entries: ${JSON.stringify(entries)}`);
    assert(entries[0] === 'strat-one' && entries[1] === 'strat-two', 'expected both strategy ids');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 14. Blocking error maps to non-zero exit code
test('blocking error maps to non-zero exit code', () => {
  const manifest = makeManifest('strat-bad', {
    strategy: { validationStatus: 'mock', provenance: { ...REAL_PROV } },
  });
  const issues = validateManifest(manifest);
  assert(exitCodeFor(issues) === 1, 'expected exit code 1 for blocking error');
  assert(exitCodeFor([]) === 0, 'expected exit code 0 for clean run');
});

// 15. Optional-field warning does not block
test('optional-field warning does not block', () => {
  const manifest = makeManifest('strat-real', {
    strategy: realStrategy('strat-real'),
    top: { tagline: undefined },
  });
  const issues = validateManifest(manifest);
  assert(hasWarning(issues, 'tagline'), `expected tagline warning: ${JSON.stringify(issues)}`);
  assert(!issues.some((issue) => issue.level === 'error'), `expected no blocking errors: ${JSON.stringify(issues)}`);
  assert(exitCodeFor(issues) === 0, 'warnings must not produce non-zero exit');
});

// 16. Existing mocks preserved
test('preserves existing mock strategies', () => {
  const entries = mockStrategies.map(mockStrategyToCatalogEntry);
  assert(entries.length === 4, `expected 4 mocks, got ${entries.length}`);
  assert(entries.every((e) => e.dataStatus === 'mock' && e.validationStatus === 'mock'), 'mocks must be tagged mock/mock');
  const ids = entries.map((e) => e.id).sort();
  assert(ids.includes('atlas-btc') && ids.includes('northstar-multi') && ids.includes('signal-spy') && ids.includes('vector-eth'), 'expected known mock ids');
});

// 17. Forbidden public extension is blocked
test('forbids forbidden extensions in public evidence', () => {
  const manifest = makeManifest('strat-real', {
    strategy: realStrategy('strat-real'),
    top: { evidence: [{ file: 'source.mq5', kind: 'source', classification: 'public' }] },
  });
  const issues = validateManifest(manifest);
  assert(hasError(issues, 'evidence[0].classification'), `expected forbidden extension issue: ${JSON.stringify(issues)}`);
});

// 18. Repository examples are valid
test('repository examples are valid', () => {
  const result = processDirectory(EXAMPLES_DIR);
  assert(result.issues.length === 0, `examples must be clean: ${JSON.stringify(result.issues)}`);
  assert(result.manifests.length === 3, `expected 3 examples: ${result.manifests.length}`);
});

// 19. First Triangle importer extracts the authorized metrics from the source files
test('First Triangle importer extracts authorized metrics', () => {
  const manifest = buildFirstTriangleManifest();
  const m = manifest.results?.metrics;
  assert(m, 'results.metrics must exist');
  assert(m.profitFactor === 1.2559299201689968, `profitFactor: ${m.profitFactor}`);
  assert(m.winRate === 51.03448275862069, `winRate: ${m.winRate}`);
  assert(m.trades === 145, `trades: ${m.trades}`);
  assert(Math.abs(m.netUsd! - 6687.5) < 0.01, `netUsd: ${m.netUsd}`);
  assert(Math.abs(m.maxDrawdownUsd! - 4474.8) < 0.01, `maxDrawdownUsd: ${m.maxDrawdownUsd}`);
  assert(Math.abs(m.costPerTradeUsd! - 1.2) < 1e-9, `costPerTradeUsd: ${m.costPerTradeUsd}`);
  assert(manifest.results?.equity?.length === 145, `equity points: ${manifest.results?.equity?.length}`);
  assert(manifest.results?.period?.start?.startsWith('2025-08-14T'), `period start: ${manifest.results?.period?.start}`);
  assert(manifest.results?.period?.end?.startsWith('2026-08-07T'), `period end: ${manifest.results?.period?.end}`);
  assert(manifest.dataset.strategies[0]?.validationStatus === 'owner_supplied_under_review', 'validationStatus');
  assert(manifest.dataset.strategies[0]?.provenance.dataStatus === 'real', 'dataStatus');
});

// 20. First Triangle passes the publication filter with a drawdown-penalized score
test('First Triangle passes filter with drawdown-penalized score', () => {
  const result = processManifest(MANIFEST_PATH);
  assert(result.issues.length === 0, `expected no issues: ${JSON.stringify(result.issues)}`);
  assert(result.entry?.published === true, `expected published: ${JSON.stringify(result.entry?.filterReasons)}`);
  assert(result.entry?.score !== undefined, 'expected score');
  const score = result.entry!.score!;
  assert(score.value >= 0 && score.value <= 100, `score range: ${score.value}`);
  const dd = score.components.find((c) => c.key === 'drawdown');
  assert(dd?.available === true, 'drawdown component must be available');
  assert(dd!.points < 80, `drawdown must visibly penalize, got ${dd!.points}`);
});

// 21. Public catalog strips internal states but keeps the generated data
test('public catalog strips internal states', () => {
  const result = processManifest(MANIFEST_PATH);
  const publicList = buildPublicCatalog([result.entry!]);
  assert(publicList.length === 1, `expected 1 published, got ${publicList.length}`);
  const publicEntry = publicList[0]!;
  assert(!('validationStatus' in publicEntry), 'no validationStatus');
  assert(!('dataStatus' in publicEntry), 'no dataStatus');
  assert(!('status' in publicEntry), 'no status');
  assert(publicEntry.metrics?.profitFactor === 1.2559299201689968, 'metrics preserved');
  assert(publicEntry.equity?.points.length === 145, 'equity preserved');
});

// 22. A strategy below the minimum Profit Factor is excluded
test('non-passing strategy is excluded from public catalog', () => {
  const decision = evaluatePublishFilter({
    name: 'Weak',
    dataStatus: 'real',
    profitFactor: 1.1,
    trades: 100,
    equityPointCount: 10,
  });
  assert(decision.publish === false, 'expected blocked');
  assert(decision.reasons.some((r) => r.includes('1.20')), `expected PF reason: ${JSON.stringify(decision.reasons)}`);
});

// ---------------------------------------------------------------------------
// Run
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
