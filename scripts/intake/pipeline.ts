/**
 * QNT-0003 strategy intake pipeline.
 *
 * Pure orchestration primitives plus filesystem helpers: manifest discovery,
 * evidence hashing (SHA-256), privacy classification, deterministic catalog
 * construction and report rendering. The CLI (`scripts/strategy-intake.ts`)
 * wires these together against the repository directories.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type { EquityPoint } from '../../src/domain/types.ts';
import type { PublicStrategy, QuantoraScore } from '../../src/domain/publicStrategy.ts';
import type { Manifest, ManifestEvidence, ManifestIssue } from './manifest.ts';
import { validateManifest } from './manifest.ts';
import { computeQuantoraScore } from './scoring.ts';
import { evaluatePublishFilter } from './filter.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResolvedEvidence = {
  /** Basename only — local filesystem paths are never part of the output. */
  name: string;
  kind: string;
  classification: 'public' | 'private';
  /** SHA-256 hex digest of the file bytes. */
  hash: string;
};

export type CatalogEntry = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  tagline?: string;
  type?: string;
  market?: string;
  instrument?: string;
  status?: string;
  validationStatus?: string;
  dataStatus?: string;
  assets: string[];
  rules?: string[];
  limitations?: string[];
  costs?: Record<string, string>;
  variant?: string;
  configuration?: string;
  disclaimer?: string;
  metrics?: Record<string, number>;
  period?: { start?: string; end?: string; timeframe?: string };
  equity?: { currency?: string; points: EquityPoint[] };
  /** Convenience accessor to `metrics.trades` (kept for report/test ergonomics). */
  trades?: number;
  score?: QuantoraScore;
  /** QNT-0003H public transparency + versioning (safe to expose). */
  reviewLabel?: string;
  independentReproduction?: boolean;
  costsApplied?: boolean;
  scoreVersion?: string;
  filterVersion?: string;
  publicationMode?: 'documentary' | 'results';
  /** Unit of results metrics/equity ("points" or "usd", default "usd"). */
  performanceUnit?: 'points' | 'usd';
  /** Publication filter outcome (internal — never part of the public catalog). */
  published?: boolean;
  filterReasons?: string[];
  evidencePublic?: { name: string; kind: string; hash: string }[];
  evidencePrivate?: { kind: string; hash: string }[];
  /** Mock presentation metadata, preserved verbatim (demo only). */
  demo?: Record<string, unknown>;
};

export type ProcessedManifest = {
  path: string;
  manifest: Manifest | null;
  entry: CatalogEntry | null;
  issues: ManifestIssue[];
  warnings: ManifestIssue[];
  evidence: ResolvedEvidence[];
};

export type IntakeSummary = {
  generatedAt: string;
  strategyCount: number;
  issues: ManifestIssue[];
  warnings: ManifestIssue[];
  catalog: CatalogEntry[];
};

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** Recursively finds `*.manifest.json` files under `dir`, sorted for determinism. */
export function discoverManifests(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    if (!existsSync(current)) return;
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (name.endsWith('.manifest.json')) found.push(full);
    }
  };
  walk(dir);
  return found.sort();
}

// ---------------------------------------------------------------------------
// Evidence resolution (hash + privacy)
// ---------------------------------------------------------------------------

export function resolveEvidence(
  manifest: Manifest,
  manifestPath: string,
): { evidence: ResolvedEvidence[]; issues: ManifestIssue[] } {
  const issues: ManifestIssue[] = [];
  const baseDir = dirname(manifestPath);
  const evidence: ResolvedEvidence[] = [];

  for (const [index, entry] of (manifest.evidence ?? []).entries()) {
    const filePath = resolve(baseDir, entry.file);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      // Evidence kept out of git may still be represented by a stored digest.
      if (entry.sha256) {
        evidence.push({
          name: basename(entry.file),
          kind: entry.kind,
          classification: entry.classification,
          hash: entry.sha256.toLowerCase(),
        });
        continue;
      }
      issues.push({
        level: 'error',
        path: `evidence[${index}].file`,
        message: `Evidence file not found: ${entry.file}`,
      });
      continue;
    }
    const hash = sha256File(filePath);
    if (entry.sha256 && entry.sha256.toLowerCase() !== hash) {
      issues.push({
        level: 'error',
        path: `evidence[${index}].sha256`,
        message: `SHA-256 mismatch for ${entry.file}.`,
      });
    }
    evidence.push({ name: basename(entry.file), kind: entry.kind, classification: entry.classification, hash });
  }

  // Deterministic ordering: private first (hash-only), then public (name + hash).
  evidence.sort((a, b) => {
    if (a.classification !== b.classification) return a.classification === 'private' ? -1 : 1;
    if (a.hash !== b.hash) return a.hash < b.hash ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { evidence, issues };
}

// ---------------------------------------------------------------------------
// Manifest -> catalog entry
// ---------------------------------------------------------------------------

function metricsOf(value: Record<string, unknown> | undefined): Record<string, number> | undefined {
  if (!value) return undefined;
  const metrics: Record<string, number> = {};
  const keys = Object.keys(value).sort();
  for (const key of keys) {
    const item = value[key];
    if (typeof item === 'number' && Number.isFinite(item)) metrics[key] = item;
  }
  return keys.length && Object.keys(metrics).length ? metrics : undefined;
}

export function manifestToCatalogEntry(manifest: Manifest, evidence: ResolvedEvidence[]): CatalogEntry {
  const strategy = manifest.dataset.strategies[0]!;
  const assetById = new Map(manifest.dataset.assets.map((asset) => [asset.id, asset]));
  const assets = strategy.assetIds
    .map((id) => assetById.get(id)?.symbol)
    .filter((symbol): symbol is string => typeof symbol === 'string' && symbol.length > 0)
    .sort();

  const backtest = manifest.dataset.backtests.find((item) => item.strategyId === strategy.id);
  const equityCurve = manifest.dataset.equityCurves.find((item) => item.strategyId === strategy.id);
  const tradeLogCount = manifest.dataset.tradeLogs.filter((item) => item.strategyId === strategy.id).length;

  const entry: CatalogEntry = {
    id: strategy.id,
    name: strategy.name,
    version: strategy.version,
    description: strategy.description,
    tagline: manifest.tagline,
    type: manifest.type,
    market: manifest.market,
    instrument: manifest.instrument,
    status: strategy.status,
    validationStatus: strategy.validationStatus,
    dataStatus: strategy.provenance.dataStatus,
    assets,
    rules: manifest.rules,
    limitations: manifest.limitations,
    costs: manifest.costs,
    variant: manifest.variant,
    configuration: manifest.configuration,
    disclaimer: manifest.disclaimer,
    // QNT-0003H public transparency + versioning.
    publicationMode: manifest.publicationMode,
    reviewLabel: manifest.reviewLabel,
    independentReproduction: manifest.independentReproduction,
    costsApplied: manifest.costsApplied,
    filterVersion: manifest.filterVersion,
    scoreVersion: manifest.scoreVersion,
    performanceUnit: manifest.performanceUnit ?? 'usd',
  };

  // Faithful `results` (real owner deliveries) take precedence over the strict
  // domain dataset, which remains the fallback for fixtures that already carry
  // backtests/equity curves.
  const results = manifest.results;
  if (results?.period) entry.period = results.period;
  if (results?.metrics) entry.metrics = sortMetrics(results.metrics);
  if (results?.equity) entry.equity = { points: results.equity };

  if (!entry.period && backtest) {
    entry.period = { start: backtest.startedAt, end: backtest.endedAt, timeframe: backtest.timeframe };
  }
  if (!entry.metrics && backtest) {
    entry.metrics = metricsOf(backtest.metrics as unknown as Record<string, unknown>);
  }
  if (!entry.equity && equityCurve) {
    entry.equity = { currency: equityCurve.currency, points: equityCurve.points };
  }
  if (entry.metrics && entry.metrics.trades === undefined && tradeLogCount > 0) {
    entry.metrics = { ...entry.metrics, trades: tradeLogCount };
  }
  if (entry.metrics?.trades !== undefined) entry.trades = entry.metrics.trades;

  // A documentary strategy with no results data receives no score (a missing
  // value is never invented and is not presented as a zero).
  const hasResultsData = Boolean(entry.metrics || entry.equity);
  if (hasResultsData) {
    entry.score = scoreEntry(entry, results?.evidenceComplete, entry.costsApplied);
  }

  const filter = evaluatePublishFilter({
    id: entry.id,
    name: entry.name,
    version: entry.version,
    descriptionOrRules: Boolean(entry.description || (entry.rules?.length ?? 0) > 0),
    marketOrAssets: Boolean(entry.market || entry.instrument || entry.assets.length > 0),
    limitations: Boolean(entry.limitations && entry.limitations.length > 0),
    provenanceValid: entry.dataStatus === 'real' || entry.dataStatus === 'mock',
    validationStatusCompatible: entry.validationStatus !== 'rejected',
    evidenceAvailable:
      Boolean(manifest.evidence && manifest.evidence.length > 0) ||
      Boolean(strategy.provenance?.sourceName),
    dataStatus: entry.dataStatus,
    publicationMode: entry.publicationMode,
    profitFactor: entry.metrics?.profitFactor,
    trades: entry.metrics?.trades,
    equityPointCount: entry.equity?.points.length,
    periodStart: entry.period?.start,
    periodEnd: entry.period?.end,
    // Unit-agnostic drawdown value (points-based strategies use maxDrawdownPoints).
    maxDrawdownUsd: entry.metrics?.maxDrawdownUsd ?? entry.metrics?.maxDrawdownPoints,
    costsApplied: entry.costsApplied,
  });
  entry.published = filter.publish;
  entry.filterReasons = filter.reasons;

  const publicEvidence = evidence
    .filter((item) => item.classification === 'public')
    .map((item) => ({ name: item.name, kind: item.kind, hash: item.hash }));
  const privateEvidence = evidence
    .filter((item) => item.classification === 'private')
    .map((item) => ({ kind: item.kind, hash: item.hash }));

  if (publicEvidence.length) entry.evidencePublic = publicEvidence;
  if (privateEvidence.length) entry.evidencePrivate = privateEvidence;

  return entry;
}

function sortMetrics(value: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (typeof item === 'number' && Number.isFinite(item)) out[key] = item;
  }
  return out;
}

function scoreEntry(entry: CatalogEntry, evidenceComplete?: number, costsApplied?: boolean): QuantoraScore {
  // The drawdown/net ratio is unit-agnostic: point-based strategies (e.g. First
  // Triangle Gold) feed the same formula through the point metric names.
  const net = entry.metrics?.netUsd ?? entry.metrics?.netPoints;
  const drawdown = entry.metrics?.maxDrawdownUsd ?? entry.metrics?.maxDrawdownPoints;
  return computeQuantoraScore({
    profitFactor: entry.metrics?.profitFactor,
    netUsd: net,
    maxDrawdownUsd: drawdown,
    equity: entry.equity?.points.map((point) => ({ timestamp: point.timestamp, equity: point.equity })),
    trades: entry.metrics?.trades,
    frequencyPerMonth: entry.metrics?.frequencyPerMonth,
    costPerTradeUsd: entry.metrics?.costPerTradeUsd,
    expectancyUsd: entry.metrics?.expectancyUsd,
    evidenceComplete,
    costsApplied,
  });
}

// ---------------------------------------------------------------------------
// Public catalog (internal states never cross this boundary)
// ---------------------------------------------------------------------------

/** Strips internal states/provenance and keeps only the client-facing fields. */
export function toPublicStrategy(entry: CatalogEntry): PublicStrategy {
  return {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    description: entry.description,
    tagline: entry.tagline,
    type: entry.type,
    market: entry.market,
    instrument: entry.instrument,
    variant: entry.variant,
    configuration: entry.configuration,
    assets: entry.assets,
    period: entry.period,
    metrics: entry.metrics,
    equity: entry.equity,
    score: entry.score,
    rules: entry.rules,
    limitations: entry.limitations,
    costs: entry.costs,
    disclaimer: entry.disclaimer,
    // QNT-0003H public transparency: commercially safe labels. Internal states
    // (status/validationStatus/dataStatus) and evidence hashes never cross here.
    reviewLabel: entry.reviewLabel,
    independentReproduction: entry.independentReproduction === true,
    costsApplied: entry.costsApplied,
    scoreVersion: entry.scoreVersion,
    filterVersion: entry.filterVersion,
    publicationMode: entry.publicationMode,
    performanceUnit: entry.performanceUnit,
  };
}

/** Only strategies that passed the publication filter reach the public catalog. */
export function buildPublicCatalog(entries: CatalogEntry[]): PublicStrategy[] {
  return entries
    .filter((entry) => entry.published === true)
    .map(toPublicStrategy)
    .sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Mock preservation
// ---------------------------------------------------------------------------

/** Structural view of the Phase 1 presentation strategy in `src/data.ts`. */
export type MockStrategyLike = {
  id: string;
  name: string;
  tagline?: string;
  assets?: string[];
  type?: string;
  description?: string;
  returnPct?: number;
  risk?: string;
  maxDrawdown?: string;
  sharpe?: string;
  winRate?: string;
  trades?: string;
  fee?: string;
};

/** Maps an existing mock strategy into the normalized catalog, tagged mock/mock. */
export function mockStrategyToCatalogEntry(strategy: MockStrategyLike): CatalogEntry {
  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    tagline: strategy.tagline,
    type: strategy.type,
    assets: (strategy.assets ?? []).slice().sort(),
    dataStatus: 'mock',
    validationStatus: 'mock',
    demo: {
      returnPct: strategy.returnPct,
      risk: strategy.risk,
      maxDrawdown: strategy.maxDrawdown,
      sharpe: strategy.sharpe,
      winRate: strategy.winRate,
      trades: strategy.trades,
      fee: strategy.fee,
    },
  };
}

// ---------------------------------------------------------------------------
// Manifest processing
// ---------------------------------------------------------------------------

export function processManifest(path: string): ProcessedManifest {
  const result: ProcessedManifest = { path, manifest: null, entry: null, issues: [], warnings: [], evidence: [] };

  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (readError) {
    result.issues.push({
      level: 'error',
      path: '',
      message: `Cannot read manifest: ${readError instanceof Error ? readError.message : 'read error'}`,
    });
    return result;
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (parseError) {
    result.issues.push({
      level: 'error',
      path: '',
      message: `Invalid JSON: ${parseError instanceof Error ? parseError.message : 'parse error'}`,
    });
    return result;
  }

  for (const issue of validateManifest(value)) {
    if (issue.level === 'warning') result.warnings.push(issue);
    else result.issues.push(issue);
  }
  if (result.issues.length > 0) return result;

  const manifest = value as Manifest;
  result.manifest = manifest;
  const resolved = resolveEvidence(manifest, path);
  result.evidence = resolved.evidence;
  result.issues.push(...resolved.issues);
  if (result.issues.length === 0) {
    result.entry = manifestToCatalogEntry(manifest, resolved.evidence);
  }
  return result;
}

export function processDirectory(dir: string): {
  manifests: ProcessedManifest[];
  issues: ManifestIssue[];
  warnings: ManifestIssue[];
} {
  const manifests = discoverManifests(dir).map(processManifest);
  return {
    manifests,
    issues: manifests.flatMap((item) => item.issues),
    warnings: manifests.flatMap((item) => item.warnings),
  };
}

// ---------------------------------------------------------------------------
// Catalog construction
// ---------------------------------------------------------------------------

export type CatalogBuildResult = { catalog: CatalogEntry[]; issues: ManifestIssue[] };

export function buildCatalog(mockEntries: CatalogEntry[], realEntries: CatalogEntry[]): CatalogBuildResult {
  const issues: ManifestIssue[] = [];
  const seen = new Set<string>();

  for (const entry of [...mockEntries, ...realEntries]) {
    if (seen.has(entry.id)) {
      issues.push({ level: 'error', path: 'catalog', message: `Duplicate strategy id "${entry.id}".` });
    } else {
      seen.add(entry.id);
    }
  }

  const catalog = [...mockEntries, ...realEntries].sort((a, b) => a.id.localeCompare(b.id));
  return { catalog, issues };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function exitCodeFor(issues: ManifestIssue[]): number {
  return issues.some((issue) => issue.level === 'error') ? 1 : 0;
}

export function renderHumanReport(summary: IntakeSummary): string {
  const lines: string[] = [];
  lines.push('Quantora strategy intake report');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Strategies in catalog: ${summary.strategyCount}`);
  lines.push('');
  lines.push(`Blocking errors: ${summary.issues.length}`);
  for (const issue of summary.issues) lines.push(`  [error] ${issue.path}: ${issue.message}`);
  lines.push('');
  lines.push(`Warnings: ${summary.warnings.length}`);
  for (const issue of summary.warnings) lines.push(`  [warn] ${issue.path}: ${issue.message}`);
  lines.push('');
  lines.push('Catalog:');
  for (const entry of summary.catalog) {
    const status = [entry.dataStatus, entry.validationStatus].filter(Boolean).join(' / ') || 'unknown';
    lines.push(`  - ${entry.id} | ${entry.name} | ${status}`);
  }
  return lines.join('\n');
}

export function renderMachineReport(summary: IntakeSummary): string {
  const data = {
    generatedAt: summary.generatedAt,
    strategyCount: summary.strategyCount,
    issues: summary.issues,
    warnings: summary.warnings,
    catalog: summary.catalog,
  };
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Re-exported for CLI convenience
// ---------------------------------------------------------------------------

export type { Manifest, ManifestEvidence, ManifestIssue };
