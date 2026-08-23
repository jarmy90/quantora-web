/**
 * QNT-0003 StochExtreme Adaptive importer.
 *
 * Reads the committed web derivatives under
 * `strategy-intake/evidence/stochextreme/` (originally extracted from
 * `STOCHEXTREME.rar`, branch `data/quantora-real-backtests`) and produces the
 * versioned strategy manifest at
 * `public-strategies/manifests/stochextreme-adaptive.manifest.json`.
 *
 * Counting rule: only the 421 closed trades in `stochextreme_trades.csv` are
 * counted. Crosses, confirmations, cancelled signals and SESSION_BLOCKED events
 * live in the (uncommitted) events file and are never counted as trades.
 *
 * Metrics and equity are extracted or calculated from the files — nothing is
 * invented and no absent field is written as zero. The importer self-checks the
 * extracted values against the authorized source summary and throws if they
 * drift, so the ingestion is reproducible.
 *
 * Run: bun run strategies:ingest:stochextreme
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import type { EquityPoint } from '../../src/domain/types.ts';
import type { Manifest } from './manifest.ts';
import { sha256File } from './pipeline.ts';

const ROOT = process.cwd();
const EVIDENCE_DIR = resolve(ROOT, 'strategy-intake/evidence/stochextreme');
export const STOCHEXTREME_MANIFEST_PATH = resolve(
  ROOT,
  'public-strategies/manifests/stochextreme-adaptive.manifest.json',
);

const EVIDENCE_REL = '../../strategy-intake/evidence/stochextreme';

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

/** "2025.08.01 00:00:00" → "2025-08-01T00:00:00Z" (source times are UTC). */
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

function assertCount(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

// ---------------------------------------------------------------------------
// Manifest construction
// ---------------------------------------------------------------------------

export function buildStochExtremeManifest(evidenceDir: string = EVIDENCE_DIR): Manifest {
  const read = (name: string): string => readFileSync(join(evidenceDir, name), 'utf8');

  const summary = parseCsv(read('stochextreme_manifest.csv'));
  const config = parseCsv(read('stochextreme_strategy_config.csv'));
  const symbol = parseCsv(read('stochextreme_symbol_specifications.csv'));
  const trades = parseCsv(read('stochextreme_trades.csv'));
  const equity = parseCsv(read('stochextreme_equity_daily.csv'));

  const summaryRow = summary.rows[0];
  const configRow = config.rows[0];
  const symbolRow = symbol.rows[0];
  if (!summaryRow || !configRow || !symbolRow) {
    throw new Error('Source CSVs must each contain a data row.');
  }

  // Authoritative run summary (never recomputed by hand).
  const profitFactor = numCol(summary, summaryRow, 'profit_factor');
  const netUsd = numCol(summary, summaryRow, 'net_profit');
  const maxDrawdownUsd = numCol(summary, summaryRow, 'max_drawdown_absolute');
  const maxDrawdownPct = numCol(summary, summaryRow, 'max_drawdown_percent');
  const tradeCount = numCol(summary, summaryRow, 'closed_trades');
  const structuralWins = numCol(summary, summaryRow, 'structural_wins');
  const structuralLosses = numCol(summary, summaryRow, 'structural_losses');
  const runStart = colValue(summary, summaryRow, 'start_time');
  const runEnd = colValue(summary, summaryRow, 'end_time');
  const strategyVersion = colValue(summary, summaryRow, 'strategy_version');

  // Economic wins/losses and gross P&L from the closed-trade log only.
  const nets = trades.rows.map((row) => numCol(trades, row, 'net_pnl'));
  const wins = nets.filter((v) => v > 0).length;
  const losses = nets.filter((v) => v <= 0).length;
  const winRate = (wins / tradeCount) * 100;
  const grossProfit = nets.filter((v) => v > 0).reduce((sum, v) => sum + v, 0);
  const grossLoss = nets.filter((v) => v < 0).reduce((sum, v) => sum + Math.abs(v), 0);
  const expectancyUsd = netUsd / tradeCount;

  // Commission and swap are reported as 0.00 for every closed trade in this
  // export (recorded as-is; no cost is invented).
  const commissions = new Set(trades.rows.map((row) => numCol(trades, row, 'commission')));
  const swaps = new Set(trades.rows.map((row) => numCol(trades, row, 'swap')));
  if (commissions.size !== 1 || swaps.size !== 1) {
    throw new Error('Expected uniform commission/swap values in the trade log.');
  }
  const costPerTradeUsd = [...commissions][0]! + [...swaps][0]!;

  // Equity curve: daily-downsampled mark-to-market equity (includes the
  // 4,690.00 USD max-drawdown point), sourced from the full minute equity file.
  const points: EquityPoint[] = equity.rows.map((row) => ({
    timestamp: toIso(colValue(equity, row, 'time')),
    equity: numCol(equity, row, 'equity'),
    drawdown: numCol(equity, row, 'drawdown_absolute'),
  }));

  const firstMs = Date.parse(points[0]!.timestamp);
  const lastMs = Date.parse(points[points.length - 1]!.timestamp);
  const days = (lastMs - firstMs) / 86_400_000;
  const frequencyPerMonth = tradeCount / (days / 30.4375);

  // Self-check against the authorized figures.
  assertClose(profitFactor, 1.151392131381321, 'profitFactor', 1e-9);
  assertClose(netUsd, 6582.0, 'netUsd', 0.01);
  assertClose(maxDrawdownUsd, 4690.0, 'maxDrawdownUsd', 0.01);
  assertClose(maxDrawdownPct, 26.53315229689975, 'maxDrawdownPct', 1e-9);
  assertClose(grossProfit, 50058.5, 'grossProfit', 0.01);
  assertClose(grossLoss, 43476.5, 'grossLoss', 0.01);
  assertClose(expectancyUsd, 15.634204275534442, 'expectancyUsd', 1e-9);
  assertCount(tradeCount, 421, 'tradeCount');
  assertCount(structuralWins, 200, 'structuralWins');
  assertCount(structuralLosses, 221, 'structuralLosses');
  assertCount(wins, 190, 'economicWins');
  assertCount(losses, 231, 'economicLosses');
  assertCount(trades.rows.length, 421, 'tradeLogRows');
  assertClose(winRate, 45.13064133016627, 'winRate', 1e-9);
  assertClose(costPerTradeUsd, 0.0, 'costPerTradeUsd', 1e-9);
  if (points.length < 2) throw new Error('Equity curve must contain at least two points.');

  const metrics: Record<string, number> = {
    profitFactor,
    winRate,
    trades: tradeCount,
    wins,
    losses,
    structuralWins,
    structuralLosses,
    frequencyPerMonth,
    maxDrawdownUsd,
    maxDrawdownPct,
    netUsd,
    expectancyUsd,
    grossProfit,
    grossLoss,
  };

  const rules = [
    `Entry: stochastic-extreme arming (${colValue(config, configRow, 'entry_model')}) on ${colValue(config, configRow, 'work_tf')}, confirmed on ${colValue(config, configRow, 'atr_tf')} (${colValue(config, configRow, 'confirm_sec')}s)`,
    `Rearm: ${colValue(config, configRow, 'rearm_policy')}`,
    `Stop: ${colValue(config, configRow, 'stop_price_distance')}-point stop (${colValue(config, configRow, 'stop_ticks')} ticks)`,
    `Target/exit: ${colValue(config, configRow, 'target_policy')} on M30 close, with ${colValue(config, configRow, 'intrabar_priority')}`,
    `Session filter: ${colValue(config, configRow, 'session_filter')} — allowed ET ${colValue(config, configRow, 'allowed_et_windows')}, blocked ET ${colValue(config, configRow, 'blocked_et_windows')}`,
  ];

  const description =
    'Historical backtest of the StochExtreme Adaptive model on Nasdaq-100 futures (AMP @ENQ). ' +
    'The model arms on stochastic extremes, requires an opposite extreme before rearming, confirms the ' +
    'signal on a shorter timeframe, and exits by stop loss or an M30-close target. Results are reconstructed ' +
    'from the owner\u2019s supplied closed-trade history (421 closed trades).';

  return {
    manifestVersion: '1.0',
    strategyId: 'stochextreme-adaptive',
    tagline: 'Stochastic-extreme intraday model on Nasdaq-100',
    type: 'Historical backtest',
    market: 'Nasdaq-100',
    instrument: 'AMP @ENQ',
    // QNT-0003H: versioned publication contract (beta). Costs were NOT applied
    // in this export (0.00 USD/trade is the recorded export value, not a
    // confirmed real cost), so costsApplied is explicitly false.
    publicationMode: 'results',
    filterVersion: 'beta-1',
    scoreVersion: 'beta-1',
    reviewLabel: 'Owner supplied',
    independentReproduction: false,
    costsApplied: false,
    // QNT-0011 public product state (commercially safe).
    productId: 'stochextreme-ustec',
    productStatus: 'coming_soon',
    commercialDownloadEnabled: false,
    rules,
    limitations: [
      'Period analyzed: 2025-08-01 to 2026-08-07',
      'Single market: Nasdaq-100 (AMP @ENQ)',
      '421 closed trades (crosses, confirmations, cancelled signals and SESSION_BLOCKED are not counted)',
      'Commission/swap: 0.00 USD per trade (not applied in this export)',
      'Maximum drawdown: 4,690.00 USD (26.53%)',
      'Historical backtest reconstructed from owner-supplied data; Quantora has not independently reproduced it',
    ],
    costs: {
      commission: '0.00 USD per trade (not applied in this export)',
      swap: '0.00 USD per trade (not applied in this export)',
    },
    variant: `Long and short (${colValue(config, configRow, 'entry_model')})`,
    configuration: `${colValue(config, configRow, 'strategy')} / ${colValue(config, configRow, 'work_tf')} / ${colValue(config, configRow, 'atr_tf')} confirm / 100pt stop`,
    disclaimer:
      'Historical results calculated from the available data. Past performance does not guarantee future results.',
    evidence: [
      {
        file: `${EVIDENCE_REL}/stochextreme_equity_daily.csv`,
        kind: 'equity',
        classification: 'public',
        sha256: sha256File(join(evidenceDir, 'stochextreme_equity_daily.csv')),
        note: 'Daily-downsampled mark-to-market equity (derived)',
      },
      {
        file: `${EVIDENCE_REL}/stochextreme_manifest.csv`,
        kind: 'summary',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'stochextreme_manifest.csv')),
        note: 'Closed-run summary metrics',
      },
      {
        file: `${EVIDENCE_REL}/stochextreme_strategy_config.csv`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'stochextreme_strategy_config.csv')),
        note: 'Strategy configuration and rules',
      },
      {
        file: `${EVIDENCE_REL}/stochextreme_symbol_specifications.csv`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'stochextreme_symbol_specifications.csv')),
        note: 'Broker/symbol specifications',
      },
      {
        file: `${EVIDENCE_REL}/stochextreme_coverage.csv`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'stochextreme_coverage.csv')),
        note: 'Tick/warmup coverage',
      },
      {
        file: `${EVIDENCE_REL}/stochextreme_trades.csv`,
        kind: 'trades',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'stochextreme_trades.csv')),
        note: 'Closed-trade log (421 trades)',
      },
    ],
    results: {
      period: { start: toIso(runStart), end: toIso(runEnd) },
      metrics,
      equity: points,
      evidenceComplete: 1,
    },
    dataset: {
      modelVersion: '1.0',
      strategies: [
        {
          id: 'stochextreme-adaptive',
          name: 'StochExtreme Adaptive',
          description,
          version: strategyVersion,
          status: 'active',
          validationStatus: 'owner_supplied_under_review',
          assetIds: ['amp-enq'],
          backtestIds: [],
          createdAt: '2025-08-01T00:00:00Z',
          updatedAt: '2025-08-01T00:00:00Z',
          provenance: {
            dataStatus: 'real',
            sourceName: 'StochExtreme Adaptive (owner delivery)',
            sourceType: 'owner-delivery',
            receivedAt: '2025-08-01T00:00:00Z',
            sourceFile: 'STOCHEXTREME.rar',
            notes:
              'Source: data/quantora-real-backtests, archive STOCHEXTREME.rar (RAR 5). ' +
              'Run id SEA2575_AMP_@ENQ_1754006400 (source run timestamp 2025-08-01 from run_id). ' +
              'createdAt/updatedAt reflect that source run timestamp; no separate delivery timestamp was provided.',
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
  writeFileSync(STOCHEXTREME_MANIFEST_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

function sortMetrics(metrics: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!metrics) return undefined;
  const out: Record<string, number> = {};
  for (const key of Object.keys(metrics).sort()) out[key] = metrics[key]!;
  return out;
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('ingest-stochextreme.ts') || entry.endsWith('ingest-stochextreme')) {
  const manifest = buildStochExtremeManifest();
  writeManifest(manifest);
  console.log(`Manifest written to ${STOCHEXTREME_MANIFEST_PATH}`);
  console.log(
    `StochExtreme Adaptive: ${manifest.results?.metrics?.trades} trades, PF ${manifest.results?.metrics?.profitFactor?.toFixed(5)}, net $${manifest.results?.metrics?.netUsd?.toFixed(2)}`,
  );
}
