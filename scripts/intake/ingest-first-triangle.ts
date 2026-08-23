/**
 * QNT-0003 First Triangle Adaptive importer.
 *
 * Reads the five authorized source files under
 * `strategy-intake/evidence/first-triangle/` (originally extracted from
 * `Descargar First Triangle para Quantora.zip`, branch
 * `data/quantora-real-backtests`, SHA
 * `2275c5d0e76d955c26df482be928ddd03bb9fc00`) and produces the versioned
 * strategy manifest at `public-strategies/manifests/first-triangle-adaptive.manifest.json`.
 *
 * Metrics, equity points, period and costs are extracted or calculated from the
 * files — nothing is invented and no absent field is written as zero. The
 * importer self-checks the extracted values against the authorized figures and
 * throws if they drift, so the ingestion is reproducible.
 *
 * Run: bun run strategies:ingest
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import type { EquityPoint } from '../../src/domain/types.ts';
import type { Manifest } from './manifest.ts';
import { sha256File } from './pipeline.ts';

const ROOT = process.cwd();
const EVIDENCE_DIR = resolve(ROOT, 'strategy-intake/evidence/first-triangle');
export const MANIFEST_PATH = resolve(ROOT, 'public-strategies/manifests/first-triangle-adaptive.manifest.json');

const EVIDENCE_REL = '../../strategy-intake/evidence/first-triangle';

// ---------------------------------------------------------------------------
// Small deterministic CSV/date helpers (source files contain no quoted commas).
// ---------------------------------------------------------------------------

type Csv = { headers: string[]; rows: string[][] };

function parseCsv(text: string): Csv {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV must contain a header and at least one row.');
  const headers = lines[0]!.split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(',').map((v) => v.trim()));
  return { headers, rows };
}

/** "2025.08.14 01:30:00" → "2025-08-14T01:30:00Z" (source times are UTC). */
function toIso(dotDateTime: string): string {
  const [date, time] = dotDateTime.split(' ');
  if (!date || !time) throw new Error(`Unexpected source timestamp: ${dotDateTime}`);
  return `${date.replace(/\./g, '-')}T${time}Z`;
}

function colValue(csv: Csv, row: string[], name: string): string {
  const index = csv.headers.indexOf(name);
  if (index < 0) throw new Error(`Column not found: ${name}`);
  const value = row[index];
  if (value === undefined) throw new Error(`Missing value for column: ${name}`);
  return value;
}

function numCol(csv: Csv, row: string[], name: string): number {
  const value = colValue(csv, row, name);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Non-numeric value for ${name}: ${value}`);
  return parsed;
}

function assertClose(actual: number, expected: number, label: string, tolerance: number): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

// ---------------------------------------------------------------------------
// Manifest construction
// ---------------------------------------------------------------------------

export function buildFirstTriangleManifest(evidenceDir: string = EVIDENCE_DIR): Manifest {
  const read = (name: string): string => readFileSync(join(evidenceDir, name), 'utf8');

  const sourceManifest = JSON.parse(read('first_triangle_web_manifest.json')) as {
    strategy?: string;
    disclaimer?: string;
  };
  const summary = parseCsv(read('first_triangle_web_summary.csv'));
  const equity = parseCsv(read('first_triangle_web_equity.csv'));
  const trades = parseCsv(read('first_triangle_web_trades.csv'));
  const signals = parseCsv(read('first_triangle_web_signals.csv'));

  const summaryRow = summary.rows[0];
  if (!summaryRow) throw new Error('summary.csv has no data row.');

  const profitFactor = numCol(summary, summaryRow, 'profit_factor');
  const winRate = numCol(summary, summaryRow, 'win_rate');
  const tradeCount = numCol(summary, summaryRow, 'closed_trades');
  const wins = numCol(summary, summaryRow, 'wins');
  const losses = numCol(summary, summaryRow, 'losses');
  const netUsd = numCol(summary, summaryRow, 'net_usd');
  const netR = numCol(summary, summaryRow, 'net_r');
  const expectancyUsd = numCol(summary, summaryRow, 'expectancy_usd');
  const maxDrawdownUsd = numCol(summary, summaryRow, 'max_drawdown_usd');
  const grossProfit = numCol(summary, summaryRow, 'gross_profit');
  const grossLoss = numCol(summary, summaryRow, 'gross_loss');

  // Equity curve: closed-trade cumulative net_usd, exactly as the source supplies it.
  const points: EquityPoint[] = equity.rows.map((row) => ({
    timestamp: toIso(colValue(equity, row, 'exit_time')),
    equity: numCol(equity, row, 'equity_usd'),
    drawdown: numCol(equity, row, 'drawdown_usd'),
  }));

  // Uniform per-trade commission, taken from the trade log.
  const costValues = new Set(trades.rows.map((row) => numCol(trades, row, 'cost_usd')));
  if (costValues.size !== 1) throw new Error(`Expected a single uniform per-trade cost, got ${costValues.size} values.`);
  const costPerTradeUsd = [...costValues][0]!;

  const firstMs = Date.parse(points[0]!.timestamp);
  const lastMs = Date.parse(points[points.length - 1]!.timestamp);
  const days = (lastMs - firstMs) / 86_400_000;
  const frequencyPerMonth = tradeCount / (days / 30.4375);

  // Self-check against the authorized observed figures (tolerances cover display rounding).
  assertClose(profitFactor, 1.2559299201689968, 'profitFactor', 1e-9);
  assertClose(winRate, 51.03448275862069, 'winRate', 1e-9);
  assertClose(netUsd, 6687.5, 'netUsd', 0.01);
  assertClose(maxDrawdownUsd, 4474.8, 'maxDrawdownUsd', 0.01);
  assertClose(expectancyUsd, 46.12068965517251, 'expectancyUsd', 1e-9);
  assertClose(netR, 17.15375, 'netR', 1e-9);
  assertClose(costPerTradeUsd, 1.2, 'costPerTradeUsd', 1e-9);
  if (tradeCount !== 145) throw new Error(`tradeCount: expected 145, got ${tradeCount}`);
  if (wins !== 74 || losses !== 71) throw new Error(`wins/losses: expected 74/71, got ${wins}/${losses}`);
  if (points.length !== 145) throw new Error(`equity points: expected 145, got ${points.length}`);
  if (signals.rows.length !== 145) throw new Error(`signals: expected 145, got ${signals.rows.length}`);
  if (trades.rows.length !== 145) throw new Error(`trades: expected 145, got ${trades.rows.length}`);

  const metrics: Record<string, number> = {
    profitFactor,
    winRate,
    trades: tradeCount,
    wins,
    losses,
    frequencyPerMonth,
    maxDrawdownUsd,
    netUsd,
    expectancyUsd,
    netR,
    grossProfit,
    grossLoss,
    costPerTradeUsd,
  };

  const description =
    'Historical backtest of a systematic triangle-breakout model on Nasdaq-100 futures (AMP @ENQ). ' +
    'The model enters on the first alternating triangle signal, protects each position with a fixed ' +
    '200-point stop, and exits via an adaptive trailing rule based on maximum favorable excursion or an ' +
    'opposite triangle signal. Results are reconstructed from the owner\u2019s supplied trade history.';

  return {
    manifestVersion: '1.0',
    strategyId: 'first-triangle-adaptive',
    tagline: 'Rules-based triangle-breakout backtest on Nasdaq-100',
    type: 'Historical backtest',
    market: 'Nasdaq-100',
    instrument: 'AMP @ENQ',
    // QNT-0003H: versioned publication contract (beta).
    publicationMode: 'results',
    filterVersion: 'beta-1',
    scoreVersion: 'beta-1',
    reviewLabel: 'Owner supplied',
    independentReproduction: false,
    costsApplied: true,
    // QNT-0011 public product state (commercially safe).
    productId: 'first-triangle-ustec-m30',
    productStatus: 'coming_soon',
    commercialDownloadEnabled: false,
    rules: [
      'Entry: FIRST_ALTERNATING_TRIANGLE signal (long and short)',
      'Stop: FIXED_200PTS (fixed 200-point stop)',
      'Exit: ADAPTIVE_MFE_GIVEBACK (adaptive trailing exit) or OPPOSITE_TRIANGLE (opposite triangle signal)',
    ],
    limitations: [
      'Period analyzed: 2025-08-14 to 2026-08-07',
      'Single market: Nasdaq-100 (AMP @ENQ)',
      '145 closed trades',
      'Commission: 1.20 USD per trade',
      'Maximum drawdown: 4,474.80 USD',
      'Historical backtest reconstructed from owner-supplied data; Quantora has not independently reproduced it',
    ],
    costs: { commission: '1.20 USD per trade' },
    variant: 'Long and short (FIRST_ALTERNATING_TRIANGLE)',
    configuration: 'FIRST_ALTERNATING_TRIANGLE / FIXED_200PTS / ADAPTIVE_MFE_GIVEBACK',
    disclaimer:
      'Historical results calculated from the available data. Past performance does not guarantee future results.',
    evidence: [
      {
        file: `${EVIDENCE_REL}/first_triangle_web_equity.csv`,
        kind: 'equity',
        classification: 'public',
        sha256: sha256File(join(evidenceDir, 'first_triangle_web_equity.csv')),
        note: 'Closed-trade cumulative equity curve',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_web_manifest.json`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_web_manifest.json')),
        note: 'Source run metadata and selection',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_web_summary.csv`,
        kind: 'summary',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_web_summary.csv')),
        note: 'Closed-run summary metrics',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_web_trades.csv`,
        kind: 'trades',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_web_trades.csv')),
        note: 'Closed-trade log',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_web_signals.csv`,
        kind: 'signals',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_web_signals.csv')),
        note: 'Signal/entry log',
      },
    ],
    results: {
      period: { start: points[0]!.timestamp, end: points[points.length - 1]!.timestamp },
      metrics,
      equity: points,
      evidenceComplete: 1,
    },
    dataset: {
      modelVersion: '1.0',
      strategies: [
        {
          id: 'first-triangle-adaptive',
          name: 'First Triangle Adaptive',
          description,
          version: '1.00',
          status: 'active',
          validationStatus: 'owner_supplied_under_review',
          assetIds: ['amp-enq'],
          backtestIds: [],
          createdAt: '2025-08-01T00:00:00Z',
          updatedAt: '2025-08-01T00:00:00Z',
          provenance: {
            dataStatus: 'real',
            sourceName: 'First Triangle for Quantora (owner delivery)',
            sourceType: 'owner-delivery',
            receivedAt: '2025-08-01T00:00:00Z',
            sourceFile: 'Descargar First Triangle para Quantora.zip',
            notes:
              `Source: data/quantora-real-backtests @ 2275c5d0e76d955c26df482be928ddd03bb9fc00. ` +
              `Source strategy name "${sourceManifest.strategy ?? 'unknown'}". ` +
              'createdAt/updatedAt reflect the source run timestamp (2025-08-01) from source_run_id; no separate delivery timestamp was provided.',
          },
        },
      ],
      assets: [
        {
          id: 'amp-enq',
          symbol: '@ENQ',
          name: 'Nasdaq-100',
          assetClass: 'future',
          exchange: 'AMP',
        },
      ],
      backtests: [],
      equityCurves: [],
      tradeLogs: [],
    },
  };
}

function writeManifest(manifest: Manifest): void {
  const results = manifest.results;
  const sortedResults = results
    ? {
        period: results.period,
        metrics: sortMetrics(results.metrics),
        equity: results.equity,
        evidenceComplete: results.evidenceComplete,
      }
    : undefined;
  const sorted = { ...manifest, results: sortedResults };
  writeFileSync(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

function sortMetrics(metrics: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!metrics) return undefined;
  const out: Record<string, number> = {};
  for (const key of Object.keys(metrics).sort()) out[key] = metrics[key]!;
  return out;
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('ingest-first-triangle.ts') || entry.endsWith('ingest-first-triangle')) {
  const manifest = buildFirstTriangleManifest();
  writeManifest(manifest);
  console.log(`Manifest written to ${MANIFEST_PATH}`);
  console.log(
    `First Triangle Adaptive: ${manifest.results?.metrics?.trades} trades, PF ${manifest.results?.metrics?.profitFactor?.toFixed(5)}, net $${manifest.results?.metrics?.netUsd?.toFixed(2)}`,
  );
}
