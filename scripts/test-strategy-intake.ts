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
import { evaluatePublishFilter, MIN_PROFIT_FACTOR } from './intake/filter.ts';
import { buildFirstTriangleManifest, MANIFEST_PATH } from './intake/ingest-first-triangle.ts';
import { buildStochExtremeManifest, STOCHEXTREME_MANIFEST_PATH } from './intake/ingest-stochextreme.ts';
import {
  AUTHORIZED_SOURCE_SHA256,
  buildTmBandasS3Manifest,
  TM_BANDAS_S3_MANIFEST_PATH,
} from './intake/ingest-tm-bandas-s3.ts';
import {
  AUTHORIZED,
  buildFirstTriangleGoldManifest,
  FIRST_TRIANGLE_GOLD_MANIFEST_PATH,
  SOURCE_ARCHIVE_SHA256,
} from './intake/ingest-first-triangle-gold.ts';
import { computeQuantoraScore, FAVORABLE_PROFIT_FACTOR } from './intake/scoring.ts';
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
    profitFactor: 1.14,
    trades: 100,
    equityPointCount: 10,
    periodStart: '2025-01-01T00:00:00Z',
    periodEnd: '2025-12-31T00:00:00Z',
    maxDrawdownUsd: 100,
    costsApplied: true,
  });
  assert(decision.publish === false, 'expected blocked');
  assert(
    decision.reasons.some((r) => r.includes(`${MIN_PROFIT_FACTOR.toFixed(2)}`)),
    `expected PF reason: ${JSON.stringify(decision.reasons)}`,
  );
});

// 23. Publication filter boundary: PF 1.14 blocked, 1.15/1.19/1.20 pass
test('publication filter Profit Factor boundary (1.14, 1.15, 1.19, 1.20)', () => {
  const base = {
    name: 'Boundary',
    dataStatus: 'real',
    trades: 100,
    equityPointCount: 10,
    periodStart: '2025-01-01T00:00:00Z',
    periodEnd: '2025-12-31T00:00:00Z',
    maxDrawdownUsd: 100,
    costsApplied: true,
  };
  assert(evaluatePublishFilter({ ...base, profitFactor: 1.14 }).publish === false, 'PF 1.14 must be blocked');
  assert(evaluatePublishFilter({ ...base, profitFactor: 1.15 }).publish === true, 'PF 1.15 must pass');
  assert(evaluatePublishFilter({ ...base, profitFactor: 1.19 }).publish === true, 'PF 1.19 must pass');
  assert(evaluatePublishFilter({ ...base, profitFactor: 1.2 }).publish === true, 'PF 1.20 must pass');
});

// 24. Profit Factor favorable tier (>= 1.20) is rewarded in the score
test('Profit Factor favorable tier (>= 1.20) is rewarded in the score', () => {
  const below = computeQuantoraScore({ profitFactor: 1.19, netUsd: 1000, maxDrawdownUsd: 100, trades: 100 });
  const at = computeQuantoraScore({ profitFactor: 1.2, netUsd: 1000, maxDrawdownUsd: 100, trades: 100 });
  const belowPf = below.components.find((c) => c.key === 'profitFactor');
  const atPf = at.components.find((c) => c.key === 'profitFactor');
  assert(belowPf && atPf, 'profitFactor component must exist');
  assert(atPf!.points > belowPf!.points, `PF 1.20 must score higher than 1.19 (${belowPf!.points} vs ${atPf!.points})`);
  assert(
    atPf!.note?.includes(FAVORABLE_PROFIT_FACTOR.toFixed(2)),
    `favorable note missing: ${atPf!.note}`,
  );
  assert(belowPf!.note === undefined, `1.19 must not be favorable: ${belowPf!.note}`);
});

// 25. StochExtreme importer extracts the authorized metrics and counts only closed trades
test('StochExtreme importer extracts authorized metrics', () => {
  const manifest = buildStochExtremeManifest();
  const m = manifest.results?.metrics;
  assert(m, 'results.metrics must exist');
  assert(m.profitFactor === 1.151392131381321, `profitFactor: ${m.profitFactor}`);
  assert(m.trades === 421, `trades: ${m.trades}`);
  assert(m.wins === 190, `economic wins: ${m.wins}`);
  assert(m.losses === 231, `economic losses: ${m.losses}`);
  assert(m.structuralWins === 200, `structural wins: ${m.structuralWins}`);
  assert(m.structuralLosses === 221, `structural losses: ${m.structuralLosses}`);
  assert(Math.abs(m.winRate! - 45.13064133016627) < 1e-9, `winRate: ${m.winRate}`);
  assert(Math.abs(m.netUsd! - 6582.0) < 0.01, `netUsd: ${m.netUsd}`);
  assert(Math.abs(m.maxDrawdownUsd! - 4690.0) < 0.01, `maxDrawdownUsd: ${m.maxDrawdownUsd}`);
  assert(m.costPerTradeUsd === undefined, 'costPerTradeUsd must not be emitted when costsApplied=false');
  assert(manifest.results?.equity?.length === 354, `equity points: ${manifest.results?.equity?.length}`);
  assert(manifest.dataset.strategies[0]?.validationStatus === 'owner_supplied_under_review', 'validationStatus');
  assert(manifest.dataset.strategies[0]?.provenance.dataStatus === 'real', 'dataStatus');
});

// 26. StochExtreme passes the publication filter (PF 1.1514 >= 1.15)
test('StochExtreme passes filter with a drawdown-penalized score', () => {
  const result = processManifest(STOCHEXTREME_MANIFEST_PATH);
  assert(result.issues.length === 0, `expected no issues: ${JSON.stringify(result.issues)}`);
  assert(result.entry?.published === true, `expected published: ${JSON.stringify(result.entry?.filterReasons)}`);
  const score = result.entry!.score!;
  assert(score.value >= 0 && score.value <= 100, `score range: ${score.value}`);
  const dd = score.components.find((c) => c.key === 'drawdown');
  assert(dd?.available === true, 'drawdown component must be available');
  assert(dd!.points < 80, `drawdown must visibly penalize, got ${dd!.points}`);
});

// 27. StochExtreme public catalog entry strips internal states
test('StochExtreme public catalog strips internal states', () => {
  const result = processManifest(STOCHEXTREME_MANIFEST_PATH);
  const publicList = buildPublicCatalog([result.entry!]);
  assert(publicList.length === 1, `expected 1 published, got ${publicList.length}`);
  const publicEntry = publicList[0]!;
  assert(!('validationStatus' in publicEntry), 'no validationStatus');
  assert(!('dataStatus' in publicEntry), 'no dataStatus');
  assert(publicEntry.metrics?.profitFactor === 1.151392131381321, 'metrics preserved');
  assert(publicEntry.equity?.points.length === 354, 'equity preserved');
});

// ---------------------------------------------------------------------------
// QNT-0003H: public transparency, costs handling, beta score/filter, modes
// ---------------------------------------------------------------------------

const RESULTS_BASE = {
  name: 'Results',
  dataStatus: 'real',
  publicationMode: 'results' as const,
  profitFactor: 1.15,
  trades: 100,
  equityPointCount: 10,
  periodStart: '2025-01-01T00:00:00Z',
  periodEnd: '2025-12-31T00:00:00Z',
  maxDrawdownUsd: 500,
  costsApplied: true,
};

function documentaryManifest(id: string): Record<string, unknown> {
  return makeManifest(id, {
    strategy: realStrategy(id, { version: '1.00', assetIds: ['asset-1'] }),
    assets: [{ id: 'asset-1', symbol: 'TEST', name: 'Test asset', assetClass: 'other' }],
    top: {
      publicationMode: 'documentary',
      filterVersion: 'beta-1',
      reviewLabel: 'Owner supplied',
      independentReproduction: false,
      market: 'Test Market',
      rules: ['Rule one'],
      limitations: ['No results yet — documentary only.'],
      evidence: [
        { file: 'source.csv', kind: 'source', classification: 'private', sha256: 'a'.repeat(64) },
      ],
    },
  });
}

// 28. reviewLabel reaches the public output
test('reviewLabel reaches the public output', () => {
  for (const manifestPath of [MANIFEST_PATH, STOCHEXTREME_MANIFEST_PATH]) {
    const result = processManifest(manifestPath);
    assert(result.issues.length === 0, `expected no issues: ${JSON.stringify(result.issues)}`);
    const pub = buildPublicCatalog([result.entry!])[0]!;
    assert(pub.reviewLabel === 'Owner supplied', `reviewLabel: ${pub.reviewLabel}`);
  }
});

// 29. independentReproduction=false reaches the public output
test('independentReproduction=false reaches the public output', () => {
  const result = processManifest(STOCHEXTREME_MANIFEST_PATH);
  const pub = buildPublicCatalog([result.entry!])[0]!;
  assert(pub.independentReproduction === false, 'independentReproduction must be false');
});

// 30. validationStatus never reaches the public output
test('validationStatus does not reach the public output', () => {
  for (const manifestPath of [MANIFEST_PATH, STOCHEXTREME_MANIFEST_PATH]) {
    const result = processManifest(manifestPath);
    const pub = buildPublicCatalog([result.entry!])[0]!;
    assert(!('validationStatus' in pub), 'no validationStatus in public output');
    assert(!JSON.stringify(pub).includes('owner_supplied_under_review'), 'no internal status string in public output');
  }
});

// 31. dataStatus never reaches the public output
test('dataStatus does not reach the public output', () => {
  const result = processManifest(STOCHEXTREME_MANIFEST_PATH);
  const pub = buildPublicCatalog([result.entry!])[0]!;
  assert(!('dataStatus' in pub), 'no dataStatus in public output');
});

// 32. status never reaches the public output
test('status does not reach the public output', () => {
  const result = processManifest(MANIFEST_PATH);
  const pub = buildPublicCatalog([result.entry!])[0]!;
  assert(!('status' in pub), 'no status in public output');
});

// 33. First Triangle costsApplied=true
test('First Triangle costsApplied=true', () => {
  const manifest = buildFirstTriangleManifest();
  assert(manifest.costsApplied === true, `costsApplied: ${manifest.costsApplied}`);
  const result = processManifest(MANIFEST_PATH);
  const pub = buildPublicCatalog([result.entry!])[0]!;
  assert(pub.costsApplied === true, 'public costsApplied must be true');
});

// 34. StochExtreme costsApplied=false
test('StochExtreme costsApplied=false', () => {
  const manifest = buildStochExtremeManifest();
  assert(manifest.costsApplied === false, `costsApplied: ${manifest.costsApplied}`);
  const result = processManifest(STOCHEXTREME_MANIFEST_PATH);
  const pub = buildPublicCatalog([result.entry!])[0]!;
  assert(pub.costsApplied === false, 'public costsApplied must be false');
});

// 35. StochExtreme gets no available points for costs
test('StochExtreme has no available costs score component', () => {
  const result = processManifest(STOCHEXTREME_MANIFEST_PATH);
  const costs = result.entry!.score!.components.find((c) => c.key === 'costs');
  assert(costs !== undefined, 'costs component must exist');
  assert(costs!.available === false, `costs must be unavailable, got ${JSON.stringify(costs)}`);
  assert(costs!.points === 0, 'unavailable component must carry 0 points, not 100');
});

// 36. StochExtreme confidence reflects the absent costs component
test('StochExtreme confidence reflects missing costs component', () => {
  const result = processManifest(STOCHEXTREME_MANIFEST_PATH);
  const score = result.entry!.score!;
  assert(score.confidence < 1, `confidence must be reduced below 1: ${score.confidence}`);
  assert(Math.abs(score.confidence - 0.95) < 1e-9, `expected 0.95 confidence, got ${score.confidence}`);
});

// 37. scoreVersion=beta-1 on manifest, entry and score
test('scoreVersion=beta-1', () => {
  const manifest = buildFirstTriangleManifest();
  assert(manifest.scoreVersion === 'beta-1', `scoreVersion: ${manifest.scoreVersion}`);
  const result = processManifest(MANIFEST_PATH);
  assert(result.entry!.scoreVersion === 'beta-1', 'entry scoreVersion');
  assert(result.entry!.score!.version === 'beta-1', 'score.version');
  const pub = buildPublicCatalog([result.entry!])[0]!;
  assert(pub.scoreVersion === 'beta-1', 'public scoreVersion');
});

// 38. filterVersion=beta-1
test('filterVersion=beta-1', () => {
  const manifest = buildStochExtremeManifest();
  assert(manifest.filterVersion === 'beta-1', `filterVersion: ${manifest.filterVersion}`);
  const result = processManifest(STOCHEXTREME_MANIFEST_PATH);
  assert(result.entry!.filterVersion === 'beta-1', 'entry filterVersion');
  const pub = buildPublicCatalog([result.entry!])[0]!;
  assert(pub.filterVersion === 'beta-1', 'public filterVersion');
});

// 39. First Triangle publicationMode=results
test('First Triangle publicationMode=results', () => {
  const manifest = buildFirstTriangleManifest();
  assert(manifest.publicationMode === 'results', `publicationMode: ${manifest.publicationMode}`);
  const pub = buildPublicCatalog([processManifest(MANIFEST_PATH).entry!])[0]!;
  assert(pub.publicationMode === 'results', 'public publicationMode');
});

// 40. StochExtreme publicationMode=results
test('StochExtreme publicationMode=results', () => {
  const manifest = buildStochExtremeManifest();
  assert(manifest.publicationMode === 'results', `publicationMode: ${manifest.publicationMode}`);
  const pub = buildPublicCatalog([processManifest(STOCHEXTREME_MANIFEST_PATH).entry!])[0]!;
  assert(pub.publicationMode === 'results', 'public publicationMode');
});

// 41. Documentary real strategy without PF publishes as documentary
test('documentary real strategy without PF can be published', () => {
  const dir = tempDir();
  try {
    const path = writeManifest(join(dir, 'doc.manifest.json'), documentaryManifest('strat-doc'));
    const result = processManifest(path);
    assert(result.issues.length === 0, `expected no issues: ${JSON.stringify(result.issues)}`);
    assert(result.entry?.published === true, `expected published: ${JSON.stringify(result.entry?.filterReasons)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 42. Documentary does not fabricate metrics
test('documentary does not fabricate metrics', () => {
  const dir = tempDir();
  try {
    const path = writeManifest(join(dir, 'doc.manifest.json'), documentaryManifest('strat-doc'));
    const result = processManifest(path);
    assert(result.entry?.metrics === undefined, 'documentary must have no metrics');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 43. Documentary does not fabricate equity
test('documentary does not fabricate equity', () => {
  const dir = tempDir();
  try {
    const path = writeManifest(join(dir, 'doc.manifest.json'), documentaryManifest('strat-doc'));
    const result = processManifest(path);
    assert(result.entry?.equity === undefined, 'documentary must have no equity');
    assert(result.entry?.trades === undefined, 'documentary must have no trades');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 44. Documentary gets no score without sufficient results
test('documentary gets no score without sufficient results', () => {
  const dir = tempDir();
  try {
    const path = writeManifest(join(dir, 'doc.manifest.json'), documentaryManifest('strat-doc'));
    const result = processManifest(path);
    assert(result.entry?.score === undefined, 'documentary must not receive a score');
    const pub = buildPublicCatalog([result.entry!])[0]!;
    assert(pub.score === undefined, 'public documentary must not receive a score');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 45. Results mode with PF 1.14 is blocked
test('results mode with PF 1.14 is blocked', () => {
  const decision = evaluatePublishFilter({ ...RESULTS_BASE, profitFactor: 1.14 });
  assert(decision.publish === false, 'PF 1.14 must be blocked in results mode');
});

// 46. Results mode with PF 1.15 passes
test('results mode with PF 1.15 passes', () => {
  const decision = evaluatePublishFilter({ ...RESULTS_BASE, profitFactor: 1.15 });
  assert(decision.publish === true, `PF 1.15 must pass: ${JSON.stringify(decision.reasons)}`);
});

// 47. Results mode without closed trades is blocked
test('results mode without trades is blocked', () => {
  const decision = evaluatePublishFilter({ ...RESULTS_BASE, trades: 0 });
  assert(decision.publish === false, 'no-trades must be blocked');
});

// 48. Results mode without equity is blocked
test('results mode without equity is blocked', () => {
  const decision = evaluatePublishFilter({ ...RESULTS_BASE, equityPointCount: 1 });
  assert(decision.publish === false, 'no-equity must be blocked');
});

// 49. Results mode without period is blocked
test('results mode without period is blocked', () => {
  const decision = evaluatePublishFilter({
    ...RESULTS_BASE,
    periodStart: undefined,
    periodEnd: undefined,
  });
  assert(decision.publish === false, 'no-period must be blocked');
});

// 50. Results mode without drawdown is blocked
test('results mode without drawdown is blocked', () => {
  const decision = evaluatePublishFilter({ ...RESULTS_BASE, maxDrawdownUsd: undefined });
  assert(decision.publish === false, 'no-drawdown must be blocked');
});

// 51. costsApplied=false does not change the source PF
test('costsApplied=false does not change the source Profit Factor', () => {
  const manifest = buildStochExtremeManifest();
  const sourcePf = manifest.results?.metrics?.profitFactor;
  assert(sourcePf === 1.151392131381321, `source PF: ${sourcePf}`);
  const result = processManifest(STOCHEXTREME_MANIFEST_PATH);
  assert(result.entry?.published === true, 'must stay published');
  assert(result.entry?.metrics?.profitFactor === sourcePf, 'entry PF must be unchanged');
  const pub = buildPublicCatalog([result.entry!])[0]!;
  assert(pub.metrics?.profitFactor === sourcePf, 'public PF must be unchanged');
});

// 52. Passing the filter does not change independentReproduction
test('passing the filter does not change independentReproduction', () => {
  const manifest = buildFirstTriangleManifest();
  assert(manifest.independentReproduction === false, 'source independentReproduction');
  const result = processManifest(MANIFEST_PATH);
  assert(result.entry?.published === true, 'must be published');
  assert(result.entry?.independentReproduction === false, 'entry independentReproduction unchanged');
  const pub = buildPublicCatalog([result.entry!])[0]!;
  assert(pub.independentReproduction === false, 'public independentReproduction unchanged');
});

// 53. Passing the filter does not assign Quantora Validated
test('passing the filter does not assign Quantora Validated', () => {
  const manifest = buildStochExtremeManifest();
  assert(manifest.dataset.strategies[0]?.validationStatus === 'owner_supplied_under_review', 'source validationStatus');
  const result = processManifest(STOCHEXTREME_MANIFEST_PATH);
  assert(result.entry?.published === true, 'must be published');
  assert(
    result.entry?.validationStatus === 'owner_supplied_under_review',
    `entry validationStatus: ${result.entry?.validationStatus}`,
  );
  assert(!JSON.stringify(buildPublicCatalog([result.entry!])).includes('quantora_validated'), 'no validated leak');
});

// 54. The beta score does not change validationStatus
test('the beta score does not change validationStatus', () => {
  const manifest = buildStochExtremeManifest();
  const before = manifest.dataset.strategies[0]!.validationStatus;
  const result = processManifest(STOCHEXTREME_MANIFEST_PATH);
  assert(result.entry!.score!.version === 'beta-1', 'score version');
  assert(result.entry!.score!.value > 0, `score value: ${result.entry!.score!.value}`);
  assert(result.entry?.validationStatus === before, 'validationStatus must remain unchanged');
});

// ---------------------------------------------------------------------------
// QNT-0005: First Triangle Gold Adaptive (OROM15.zip, points, variant 174/BASE)
// ---------------------------------------------------------------------------

const GOLD = (): ReturnType<typeof buildFirstTriangleGoldManifest> => buildFirstTriangleGoldManifest();
const GOLD_ENTRY = (): NonNullable<ReturnType<typeof processManifest>['entry']> => {
  const result = processManifest(FIRST_TRIANGLE_GOLD_MANIFEST_PATH);
  assert(result.issues.length === 0, `gold manifest must be valid: ${JSON.stringify(result.issues)}`);
  return result.entry!;
};
const GOLD_PUBLIC = (): ReturnType<typeof buildPublicCatalog>[number] =>
  buildPublicCatalog([GOLD_ENTRY()])[0]!;

// 55. Source archive hash of the authorized OROM15.zip is recorded and verified
test('QNT-0005 source archive SHA-256 is the authorized value and importer verifies it', () => {
  assert(
    SOURCE_ARCHIVE_SHA256 === '816812315e82e067b2dfd42144b722c2cc73b231e674398a6bb71f2e05467476',
    'SOURCE_ARCHIVE_SHA256 must match the authorized OROM15.zip hash',
  );
  // buildFirstTriangleGoldManifest() throws when the recorded source-archive.sha256
  // content differs from SOURCE_ARCHIVE_SHA256 — succeeding here proves the check passed.
  const manifest = GOLD();
  const sourceHashEvidence = manifest.evidence?.find((e) => e.file.includes('source-archive.sha256'));
  assert(sourceHashEvidence !== undefined, 'manifest must record the source archive hash entry');
  assert(sourceHashEvidence!.kind === 'source', 'source-archive.sha256 evidence kind');
  const provenanceNotes = manifest.dataset.strategies[0]?.provenance.notes ?? '';
  assert(provenanceNotes.includes(SOURCE_ARCHIVE_SHA256), 'provenance notes must carry the archive hash');
});

// 56. Only variant 174 / BASE is selected: exactly 203 closed logical trades
test('QNT-0005 selects only variant 174/BASE: 203 closed trades', () => {
  const m = GOLD().results?.metrics;
  assert(m, 'metrics must exist');
  assert(m.trades === 203, `closedTrades: ${m.trades}`);
  assert(m.openPositionsAtEnd === 1, `openPositionsAtEnd: ${m.openPositionsAtEnd}`);
  assert(GOLD().results?.equity?.length === 203, 'equity must be exactly 203 points (open position excluded)');
});

// 57. 203 = 102 wins + 101 losses + 0 breakevens
test('QNT-0005 wins/losses/breakevens reconcile to 203', () => {
  const m = GOLD().results!.metrics!;
  assert(m.wins === 102, `wins: ${m.wins}`);
  assert(m.losses === 101, `losses: ${m.losses}`);
  assert(m.breakevens === 0, `breakevens: ${m.breakevens}`);
  assert(m.wins + m.losses + m.breakevens === 203, '203 = 102 + 101 + 0');
});

// 58. Profit Factor, gross profit/loss and net reconcile in points
test('QNT-0005 Profit Factor and gross/net reconcile', () => {
  const m = GOLD().results!.metrics!;
  assert(m.profitFactor === AUTHORIZED.profitFactor, `profitFactor: ${m.profitFactor}`);
  assert(Math.abs(m.grossProfitPoints - 5009.1) < 1e-6, `grossProfitPoints: ${m.grossProfitPoints}`);
  assert(Math.abs(m.grossLossPoints - 2640.35) < 1e-6, `grossLossPoints: ${m.grossLossPoints}`);
  assert(Math.abs(m.netPoints - 2368.75) < 1e-6, `netPoints: ${m.netPoints}`);
  assert(
    Math.abs(m.grossProfitPoints / m.grossLossPoints - m.profitFactor) < 1e-6,
    'PF must equal gross/gross',
  );
});

// 59. Drawdown and expectancy are in points; win rate/expectancy are CLOSED-trade
// (QNT-0005C: recomputed from the 203 closed trades, not the source 204 count).
test('QNT-0005 max drawdown in points and closed-trade win rate/expectancy', () => {
  const m = GOLD().results!.metrics!;
  assert(Math.abs(m.maxDrawdownPoints - 176.45) < 1e-6, `maxDrawdownPoints: ${m.maxDrawdownPoints}`);
  assert(Math.abs(m.expectancyPoints - 2368.75 / 203) < 1e-9, `expectancyPoints: ${m.expectancyPoints}`);
  assert(Math.abs(m.winRate - (102 / 203) * 100) < 1e-9, `winRate: ${m.winRate}`);
  assert(m.frequencyPerMonth > 14 && m.frequencyPerMonth < 16, `frequency: ${m.frequencyPerMonth}`);
});

// 60. No USD metric is emitted (absent data stays absent, never zero USD)
test('QNT-0005 emits no USD metrics', () => {
  const m = GOLD().results!.metrics!;
  for (const key of Object.keys(m)) {
    assert(!key.endsWith('Usd'), `USD metric must never be emitted: ${key}`);
  }
  const pub = GOLD_PUBLIC();
  assert(pub.metrics!.netUsd === undefined, 'no netUsd in public output');
  assert(pub.metrics!.maxDrawdownUsd === undefined, 'no maxDrawdownUsd in public output');
  assert(pub.metrics!.costPerTradeUsd === undefined, 'no costPerTradeUsd in public output');
});

// 61. Period reconciliation: DEVELOPMENT + VALIDATION + LOCKED_OOS = 203
test('QNT-0005 DEV+VAL+OOS reconciles to 203 closed trades', () => {
  const manifest = GOLD();
  assert(
    manifest.results?.metrics?.trades === AUTHORIZED.development + AUTHORIZED.validation + AUTHORIZED.lockedOos,
    'period reconciliation must equal closed trades',
  );
  assert(AUTHORIZED.development === 87 && AUTHORIZED.validation === 51 && AUTHORIZED.lockedOos === 65, 'authorized splits');
});

// 62. Monthly buckets: 10 of 12 positive months (reproducible from monthly.csv)
test('QNT-0005 monthly buckets are 10 of 12 positive months', () => {
  const manifest = GOLD();
  const limitation = manifest.limitations?.find((l) => l.includes('Positive months'));
  assert(limitation !== undefined, 'positive-months limitation must exist');
  assert(limitation!.includes('10 of 12'), `limitation: ${limitation}`);
  assert(AUTHORIZED.positiveMonths === 10 && AUTHORIZED.negativeMonths === 2, 'authorized monthly counts');
});

// 63. costsApplied=false and the costs score component is unavailable
test('QNT-0005 costsApplied=false makes the costs score component unavailable', () => {
  const manifest = GOLD();
  assert(manifest.costsApplied === false, 'costsApplied must be false');
  const entry = GOLD_ENTRY();
  assert(entry.costsApplied === false, 'entry costsApplied');
  const costs = entry.score!.components.find((c) => c.key === 'costs');
  assert(costs !== undefined, 'costs component must exist');
  assert(costs!.available === false, 'costs must be unavailable');
  assert(costs!.points === 0, 'unavailable component carries 0 points');
  assert(Math.abs(entry.score!.confidence - 0.95) < 1e-9, `confidence must drop to 0.95: ${entry.score!.confidence}`);
});

// 64. performanceUnit=points reaches the public output with point metrics
test('QNT-0005 performanceUnit=points reaches the public output', () => {
  const manifest = GOLD();
  assert(manifest.performanceUnit === 'points', `manifest performanceUnit: ${manifest.performanceUnit}`);
  assert(manifest.modelId === 'first-triangle-gold', `modelId: ${manifest.modelId}`);
  const pub = GOLD_PUBLIC();
  assert(pub.performanceUnit === 'points', 'public performanceUnit');
  assert(pub.metrics?.netPoints !== undefined, 'public netPoints');
  assert(pub.equity?.points.length === 203, 'public equity points');
});

// 65. Point metrics feed the unit-agnostic drawdown component of the beta score
test('QNT-0005 point drawdown feeds the score drawdown component', () => {
  const entry = GOLD_ENTRY();
  assert(entry.score!.version === 'beta-1', 'score version');
  const dd = entry.score!.components.find((c) => c.key === 'drawdown');
  assert(dd !== undefined && dd.available === true, 'drawdown component must be available from points');
  assert(dd!.points > 80, `drawdown vs result must score high: ${dd!.points}`);
});

// 66. Filter: results mode, PF 1.897 >= 1.15 → published
test('QNT-0005 passes the beta-1 results filter and publishes', () => {
  const entry = GOLD_ENTRY();
  assert(entry.publicationMode === 'results', 'publicationMode');
  assert(entry.filterVersion === 'beta-1', 'filterVersion');
  assert(entry.published === true, `expected published: ${JSON.stringify(entry.filterReasons)}`);
  const pub = GOLD_PUBLIC();
  assert(pub.reviewLabel === 'Owner supplied', `reviewLabel: ${pub.reviewLabel}`);
  assert(pub.independentReproduction === false, 'independentReproduction must be false');
});

// 67. Internal states never reach the public output for the gold strategy
test('QNT-0005 public output strips internal states', () => {
  const pub = GOLD_PUBLIC();
  assert(!('validationStatus' in pub), 'no validationStatus');
  assert(!('dataStatus' in pub), 'no dataStatus');
  assert(!('status' in pub), 'no status');
  assert(!JSON.stringify(pub).includes('owner_supplied_under_review'), 'no internal status string');
  assert(JSON.stringify(pub).includes('modelId') === false, 'modelId is internal and must not leak');
});

// 68. Open position is a visible limitation and never counted as a closed trade
test('QNT-0005 open position is excluded and documented', () => {
  const manifest = GOLD();
  assert(
    manifest.limitations?.some((l) => l.includes('1 open position at end excluded from closed-trade metrics')),
    `open-position limitation must exist: ${JSON.stringify(manifest.limitations)}`,
  );
  assert(GOLD().results?.metrics?.trades === 203, 'closed trades must stay 203 (not 204)');
  assert(GOLD().results?.equity?.length === 203, 'equity must not include the open position');
});

// 69. Identity fields are the authorized ones
test('QNT-0005 identity matches the authorized contract', () => {
  const manifest = GOLD();
  assert(manifest.strategyId === 'first-triangle-gold-adaptive', 'strategyId');
  assert(manifest.dataset.strategies[0]?.name === 'First Triangle Gold Adaptive', 'name');
  assert(manifest.dataset.strategies[0]?.version === '3.00', 'version');
  assert(manifest.publicationMode === 'results', 'publicationMode');
  assert(manifest.scoreVersion === 'beta-1', 'scoreVersion');
  assert(manifest.filterVersion === 'beta-1', 'filterVersion');
  assert(manifest.dataset.strategies[0]?.assetIds.includes('xauusd'), 'asset xauusd');
});

// ---------------------------------------------------------------------------
// QNT-0005C: honest closed-trade publication (win rate, expectancy, timestamps,
// drawdown magnitude, grouped transparency)
// ---------------------------------------------------------------------------

// 70. Closed-trade win rate is exactly 102 / 203 and expectancy is 2368.75 / 203
test('QNT-0005C winRate = 102/203 and expectancyPoints = 2368.75/203', () => {
  const m = GOLD().results!.metrics!;
  assert(Math.abs(m.winRate - (102 / 203) * 100) < 1e-12, `winRate must equal 102/203: ${m.winRate}`);
  assert(Math.abs(m.expectancyPoints - 2368.75 / 203) < 1e-12, `expectancyPoints must equal net/203: ${m.expectancyPoints}`);
});

// 71. Source aggregate values (204 count) never become public metrics
test('QNT-0005C source aggregate values stay internal', () => {
  const m = GOLD().results!.metrics!;
  for (const key of Object.keys(m)) {
    assert(!key.startsWith('source'), `source-only key must not be public: ${key}`);
  }
  const pub = GOLD_PUBLIC();
  assert(pub.metrics!.sourceWinRate === undefined, 'no sourceWinRate in public output');
  assert(pub.metrics!.sourceExpectancy === undefined, 'no sourceExpectancy in public output');
  const notes = GOLD().dataset.strategies[0]!.provenance.notes ?? '';
  assert(notes.includes('exported count 204'), 'provenance must document the 204 source count');
  assert(notes.includes('recomputed from the 203'), 'provenance must document the 203 recomputation');
});

// 72. The open position is excluded from PF, win rate, expectancy, net and equity
test('QNT-0005C open position excluded from every closed metric', () => {
  const m = GOLD().results!.metrics!;
  assert(m.trades === 203, 'closed trades 203');
  assert(m.wins === 102 && m.losses === 101 && m.breakevens === 0, '102/101/0');
  assert(m.openPositionsAtEnd === 1, 'open at end 1');
  assert(Math.abs(m.profitFactor - 5009.1 / 2640.35) < 1e-6, 'PF from closed gross P&L only');
  assert(Math.abs(m.netPoints - 2368.75) < 1e-6, 'net from 203 closed trades only');
  assert(Math.abs(m.winRate - (102 / 203) * 100) < 1e-9, 'win rate over 203 only');
  assert(Math.abs(m.expectancyPoints - 2368.75 / 203) < 1e-9, 'expectancy over 203 only');
  assert(GOLD().results!.equity!.length === 203, 'equity has no open position point');
});

// 73. Drawdown is stored and published as a positive magnitude
test('QNT-0005C drawdown is a positive magnitude', () => {
  const m = GOLD().results!.metrics!;
  assert(m.maxDrawdownPoints > 0, 'drawdown must be positive');
  assert(Math.abs(m.maxDrawdownPoints - 176.45) < 1e-6, 'drawdown 176.45');
  const pub = GOLD_PUBLIC();
  assert(pub.metrics!.maxDrawdownPoints > 0, 'public drawdown positive');
});

// 74. Unknown source timezone: timestamps are naive and never normalized to Z
test('QNT-0005C timestamps are naive when the source timezone is unknown', () => {
  const manifest = GOLD();
  assert(manifest.sourceTimezone === null, `sourceTimezone: ${manifest.sourceTimezone}`);
  assert(manifest.timestampNormalization === 'not_normalized', `normalization: ${manifest.timestampNormalization}`);
  const period = manifest.results!.period!;
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(period.start!), `naive start: ${period.start}`);
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(period.end!), `naive end: ${period.end}`);
  assert(!period.start!.includes('Z') && !period.end!.includes('Z'), 'no Z on period');
  for (const point of manifest.results!.equity!) {
    assert(!point.timestamp.includes('Z'), `equity timestamps must be naive: ${point.timestamp}`);
  }
  const pub = GOLD_PUBLIC();
  assert(!pub.period!.start!.includes('Z'), 'public period naive');
  assert(!pub.equity!.points[0]!.timestamp.includes('Z'), 'public equity naive');
});

// 75. sourceTimezone/timestampNormalization are internal and never exposed
test('QNT-0005C timezone metadata does not reach the public output', () => {
  const pub = GOLD_PUBLIC();
  assert(!('sourceTimezone' in pub), 'no sourceTimezone in public output');
  assert(!('timestampNormalization' in pub), 'no timestampNormalization in public output');
  assert(!JSON.stringify(pub).includes('not_normalized'), 'no normalization string leak');
});

// 76. The 204-count source convention is documented in the limitations
test('QNT-0005C limitations document the 204 vs 203 convention', () => {
  const manifest = GOLD();
  assert(
    manifest.limitations?.some((l) => l.includes('exported count of 204')) &&
      manifest.limitations!.some((l) => l.includes('recomputed from the 203 closed trades')),
    `limitations must document the source convention: ${JSON.stringify(manifest.limitations)}`,
  );
});

// ---------------------------------------------------------------------------
// QNT-0007: TM Bandas S3 intake
// ---------------------------------------------------------------------------

// 77. The importer pins the authorized source archive digest.
test('TM Bandas S3 source archive hash is the authorized digest', () => {
  assert(
    AUTHORIZED_SOURCE_SHA256 === '455294f995ede782880b847755828dc07e2b0ef4642040bca754c49f30b67f21',
    'authorized SHA-256',
  );
  const manifest = buildTmBandasS3Manifest();
  assert(manifest.dataset.strategies[0]?.provenance.sourceFile === 'bandas.zip', 'sourceFile');
  assert(manifest.dataset.strategies[0]?.provenance.dataStatus === 'real', 'dataStatus real');
});

// 78. A mismatched source hash is rejected.
test('TM Bandas S3 rejects a mismatched source archive hash', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bandas-hash-'));
  try {
    writeFileSync(join(dir, 'source-archive.sha256'), 'deadbeef'.repeat(8) + '  bandas.zip\n');
    let threw = false;
    try {
      buildTmBandasS3Manifest(dir);
    } catch {
      threw = true;
    }
    assert(threw, 'must throw on a mismatched source hash');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 79. Closed-trade metrics are extracted/reconciled from the raw log.
test('TM Bandas S3 importer extracts authorized metrics', () => {
  const manifest = buildTmBandasS3Manifest();
  const m = manifest.results?.metrics;
  assert(m, 'results.metrics must exist');
  assert(m.trades === 621, `trades: ${m.trades}`);
  assert(m.wins === 228, `wins: ${m.wins}`);
  assert(m.losses === 393, `losses: ${m.losses}`);
  assert(m.breakevens === 0, `breakevens: ${m.breakevens}`);
  assert(m.wins! + m.losses! + m.breakevens! === 621, 'wins+losses+breakevens = 621');
  assert(Math.abs(m.profitFactor! - 1.74045802) < 1e-7, `profitFactor: ${m.profitFactor}`);
  assert(Math.abs(m.winRate! - (228 / 621) * 100) < 1e-6, `winRate: ${m.winRate}`);
  assert(Math.abs(m.expectancyUsd! - 6984 / 621) < 1e-9, `expectancyUsd: ${m.expectancyUsd}`);
  assert(Math.abs(m.netUsd! - 6984.0) < 0.01, `netUsd: ${m.netUsd}`);
  assert(Math.abs(m.grossProfit! - 16416.0) < 0.01, `grossProfit: ${m.grossProfit}`);
  assert(Math.abs(m.grossLoss! - 9432.0) < 0.01, `grossLoss: ${m.grossLoss}`);
  assert(m.openPositionsAtEnd === 0, `openPositionsAtEnd: ${m.openPositionsAtEnd}`);
});

// 80. Profit Factor reconciles to gross profit / gross loss.
test('TM Bandas S3 profit factor equals gross profit over gross loss', () => {
  const m = buildTmBandasS3Manifest().results!.metrics!;
  assert(Math.abs(m.profitFactor! - m.grossProfit! / m.grossLoss!) < 1e-9, `PF reconcile: ${m.profitFactor}`);
});

// 81. Win rate and expectancy use the 621-trade closed denominator only.
test('TM Bandas S3 winRate/expectancy use the closed-trade denominator', () => {
  const m = buildTmBandasS3Manifest().results!.metrics!;
  assert(Math.abs(m.winRate! - (228 / 621) * 100) < 1e-9, `winRate: ${m.winRate}`);
  assert(Math.abs(m.expectancyUsd! - 6984 / 621) < 1e-9, `expectancyUsd: ${m.expectancyUsd}`);
  assert(m.openPositionsAtEnd === 0, 'no open position was included in the denominator');
});

// 82. The system is short-only.
test('TM Bandas S3 is short-only', () => {
  const manifest = buildTmBandasS3Manifest();
  assert(manifest.variant?.includes('short-only') === true, `variant: ${manifest.variant}`);
  assert(
    manifest.dataset.strategies[0]?.description?.includes('enters short') === true,
    'description must state short entry',
  );
});

// 83. Equity is reconstructed from closed trades (621 points, final balance).
test('TM Bandas S3 reconstructs closed-trade equity', () => {
  const manifest = buildTmBandasS3Manifest();
  const points = manifest.results!.equity!;
  assert(points.length === 621, `equity points: ${points.length}`);
  const last = points[points.length - 1]!;
  assert(Math.abs(last.equity - 16984.0) < 0.01, `final equity: ${last.equity}`);
  assert(last.timestamp === '2026-08-19T13:37:00+00:00', `last timestamp: ${last.timestamp}`);
});

// 84. Drawdown is a positive magnitude.
test('TM Bandas S3 drawdown is a positive magnitude', () => {
  const m = buildTmBandasS3Manifest().results!.metrics!;
  assert(m.maxDrawdownUsd! > 0, `drawdown must be positive: ${m.maxDrawdownUsd}`);
  assert(Math.abs(m.maxDrawdownUsd! - 384.0) < 0.01, `drawdown: ${m.maxDrawdownUsd}`);
});

// 85. Timestamps preserve the source's explicit +00:00 offset (not re-normalized).
test('TM Bandas S3 timestamps preserve the source offset', () => {
  const manifest = buildTmBandasS3Manifest();
  const period = manifest.results!.period!;
  assert(period.start === '2025-09-01T09:56:00+00:00', `start: ${period.start}`);
  assert(period.end === '2026-08-19T13:37:00+00:00', `end: ${period.end}`);
  assert(period.timeframe === 'M1', `timeframe: ${period.timeframe}`);
});

// 86. Costs are recorded as not applied; the score costs component is unavailable.
test('TM Bandas S3 costsApplied=false with unavailable costs score component', () => {
  const manifest = buildTmBandasS3Manifest();
  assert(manifest.costsApplied === false, 'costsApplied false');
  const result = processManifest(TM_BANDAS_S3_MANIFEST_PATH);
  assert(result.entry?.published === true, 'must be published');
  const costs = result.entry!.score!.components.find((c) => c.key === 'costs');
  assert(costs?.available === false, `costs component unavailable: ${JSON.stringify(costs)}`);
  assert(result.entry!.score!.confidence < 1, `confidence reduced: ${result.entry!.score!.confidence}`);
});

// 87. The strategy passes the beta-1 results filter.
test('TM Bandas S3 passes the results filter', () => {
  const result = processManifest(TM_BANDAS_S3_MANIFEST_PATH);
  assert(result.issues.length === 0, `issues: ${JSON.stringify(result.issues)}`);
  assert(result.entry?.published === true, `published: ${JSON.stringify(result.entry?.filterReasons)}`);
  assert(result.entry?.publicationMode === 'results', 'publicationMode');
  assert(result.entry?.filterVersion === 'beta-1', 'filterVersion');
  assert(result.entry?.scoreVersion === 'beta-1', 'scoreVersion');
});

// 88. Public catalog strips internal states and keeps the safe review label.
test('TM Bandas S3 public catalog strips internal states', () => {
  const result = processManifest(TM_BANDAS_S3_MANIFEST_PATH);
  const pub = buildPublicCatalog([result.entry!])[0]!;
  assert(!('validationStatus' in pub), 'no validationStatus');
  assert(!('dataStatus' in pub), 'no dataStatus');
  assert(!('status' in pub), 'no status');
  assert(pub.reviewLabel === 'Owner supplied', `reviewLabel: ${pub.reviewLabel}`);
  assert(pub.independentReproduction === false, 'independentReproduction false');
  assert(Math.abs(pub.metrics!.profitFactor! - 1.74045802) < 1e-7, 'PF preserved');
  assert(pub.equity?.points.length === 621, 'equity preserved');
});

// 89. Performance is USD and costs 0.00 is never presented as confirmed real cost.
test('TM Bandas S3 performance is USD with costsApplied=false', () => {
  const manifest = buildTmBandasS3Manifest();
  assert(manifest.costs?.commission?.includes('not applied') === true, 'commission note');
  assert(manifest.costsApplied === false, 'costsApplied false');
  const metrics = manifest.results!.metrics!;
  assert(metrics.initialCapital === 10000, `initialCapital: ${metrics.initialCapital}`);
  assert(metrics.netUsd === 6984, `netUsd: ${metrics.netUsd}`);
  assert(metrics.maxDrawdownUsd === 384, `maxDrawdownUsd: ${metrics.maxDrawdownUsd}`);
  assert(metrics.costPerTradeUsd === undefined, "costPerTradeUsd must not be present when costsApplied=false");
});

// 90. closedTradeDrawdownDecimal is derived from maxDrawdown / initialCapital
test("TM Bandas S3 closedTradeDrawdownDecimal = 384/10000 = 0.0384", () => {
  const m = buildTmBandasS3Manifest().results!.metrics!;
  assert(m.closedTradeDrawdownDecimal !== undefined, "closedTradeDrawdownDecimal must be present");
  assert(Math.abs(m.closedTradeDrawdownDecimal! - 0.0384) < 1e-9, `closedTradeDrawdownDecimal: ${m.closedTradeDrawdownDecimal}`);
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
