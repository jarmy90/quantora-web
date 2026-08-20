/**
 * QNT-0005 First Triangle Gold Adaptive importer.
 *
 * Reads the committed derived evidence under
 * `strategy-intake/evidence/first-triangle-gold/` (byte-identical copies,
 * renamed, of the files inside `OROM15.zip` from branch
 * `data/quantora-real-backtests`, commit `2dc5733`) and produces the versioned
 * strategy manifest at
 * `public-strategies/manifests/first-triangle-gold-adaptive.manifest.json`.
 *
 * Counting rule: only rows with `variant_id = 174` and `cost_scenario = BASE`
 * in `first_triangle_gold_trades.csv` are counted — 203 closed logical trades
 * (18 INITIAL_SL, 113 OPPOSITE_TRIANGLE, 72 TRAILING). The package declares one
 * position open at the end (`open_at_end = true`); it is NOT present as a row
 * in the trade log and is never counted as a closed trade, win, loss, net
 * point or equity point.
 *
 * All results are expressed in POINTS. The export warns that USD fields are
 * unavailable until broker costs are reconciled, so no USD metric is emitted
 * and `costsApplied` is false — the recorded commission/slippage of 0.0 is not
 * interpreted as a confirmed real cost.
 *
 * The importer self-checks every authorized figure against the source files
 * and throws if they drift, so the ingestion is reproducible.
 *
 * Run: bun run strategies:ingest:first-triangle-gold
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import type { EquityPoint } from '../../src/domain/types.ts';
import type { Manifest } from './manifest.ts';
import { sha256File } from './pipeline.ts';

const ROOT = process.cwd();
const EVIDENCE_DIR = resolve(ROOT, 'strategy-intake/evidence/first-triangle-gold');
export const FIRST_TRIANGLE_GOLD_MANIFEST_PATH = resolve(
  ROOT,
  'public-strategies/manifests/first-triangle-gold-adaptive.manifest.json',
);

const EVIDENCE_REL = '../../strategy-intake/evidence/first-triangle-gold';

// Authorized source archive (OROM15.zip) — verified against source-archive.sha256.
export const SOURCE_ARCHIVE_SHA256 = '816812315e82e067b2dfd42144b722c2cc73b231e674398a6bb71f2e05467476';

// Authorized identity.
export const FIRST_TRIANGLE_GOLD_ID = 'first-triangle-gold-adaptive';
export const FIRST_TRIANGLE_GOLD_VARIANT = 174;
export const FIRST_TRIANGLE_GOLD_COST_SCENARIO = 'BASE';

// Authorized figures (variant 174, BASE, expressed in points). Public metrics are
// recomputed over the 203 CLOSED trades; the source aggregate values (which used
// the exported count of 204, including the open position) are kept internally as
// sourceWinRate / sourceExpectancy in provenance notes.
export const AUTHORIZED = {
  closedTrades: 203,
  wins: 102,
  losses: 101,
  breakevens: 0,
  grossProfitPoints: 5009.1,
  grossLossPoints: 2640.35,
  netPoints: 2368.7499999999964,
  profitFactor: 1.8971348495464608,
  maxDrawdownPoints: 176.44999999999982,
  // Closed-trade metrics (QNT-0005C): recomputed from the 203 closed trades.
  winRate: 50.24630541871921, // 102 / 203
  expectancyPoints: 11.668719211822642, // 2368.75 / 203 (= periods ALL expectancy)
  sourceWinRate: 50.0, // source aggregate: wins / 204
  sourceExpectancy: 11.61151960784312, // source aggregate: net / 204
  equityPoints: 203,
  development: 87,
  validation: 51,
  lockedOos: 65,
  positiveMonths: 10,
  negativeMonths: 2,
  monthlyRows: 12,
  openPositionsAtEnd: 1,
} as const;

// ---------------------------------------------------------------------------
// Small deterministic CSV/date helpers (source files contain no quoted commas).
// ---------------------------------------------------------------------------

type Csv = { headers: string[]; rows: string[][] };

function parseCsv(text: string): Csv {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV must contain a header and at least one row.');
  const headers = lines[0]!.split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(',').map((v) => v.trim()));
  return { headers, rows };
}

/**
 * "2025.07.02 03:00:00" → "2025-07-02T03:00:00" (naive).
 *
 * The source timezone is unknown (QNT-0005C), so no Z is appended and the
 * timestamps are NOT normalized: they keep the source's naive local format.
 */
function toNaive(dotDateTime: string): string {
  const [date, time] = dotDateTime.split(' ');
  if (!date || !time) throw new Error(`Unexpected source timestamp: ${dotDateTime}`);
  return `${date.replace(/\./g, '-')}T${time}`;
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

export function buildFirstTriangleGoldManifest(evidenceDir: string = EVIDENCE_DIR): Manifest {
  const read = (name: string): string => readFileSync(join(evidenceDir, name), 'utf8');

  // 1. Source archive hash is verified against the recorded value.
  const recorded = read('source-archive.sha256').trim().toLowerCase();
  if (recorded !== SOURCE_ARCHIVE_SHA256) {
    throw new Error(
      `Source archive SHA-256 mismatch: recorded ${recorded}, authorized ${SOURCE_ARCHIVE_SHA256}`,
    );
  }

  const summary = parseCsv(read('first_triangle_gold_summary.csv'));
  const config = parseCsv(read('first_triangle_gold_strategy_config.csv'));
  const symbol = parseCsv(read('first_triangle_gold_symbol_specifications.csv'));
  const coverage = parseCsv(read('first_triangle_gold_coverage.csv'));
  const trades = parseCsv(read('first_triangle_gold_trades.csv'));
  const equity = parseCsv(read('first_triangle_gold_equity.csv'));
  const monthly = parseCsv(read('first_triangle_gold_monthly.csv'));
  const periods = parseCsv(read('first_triangle_gold_periods.csv'));
  const sourceManifest = JSON.parse(read('first_triangle_gold_manifest.json')) as Record<string, unknown>;

  const configRow = config.rows[0];
  const symbolRow = symbol.rows[0];
  const coverageRow = coverage.rows[0];
  if (!configRow || !symbolRow || !coverageRow) {
    throw new Error('Source CSVs must each contain a data row.');
  }

  // Selected variant row from the summary (variant_id = 174, BASE).
  const summaryRows = summary.rows.filter(
    (row) => Number(colValue(summary, row, 'variant_id')) === FIRST_TRIANGLE_GOLD_VARIANT,
  );
  const summaryRow = summaryRows.find(
    (row) => colValue(summary, row, 'cost_scenario') === FIRST_TRIANGLE_GOLD_COST_SCENARIO,
  );
  if (!summaryRow) throw new Error('Summary row for variant 174 / BASE not found.');

  // 2. Select only variant 174 / BASE from the full trade log (76,356 rows, all variants).
  const selected = trades.rows.filter(
    (row) =>
      Number(colValue(trades, row, 'variant_id')) === FIRST_TRIANGLE_GOLD_VARIANT &&
      colValue(trades, row, 'cost_scenario') === FIRST_TRIANGLE_GOLD_COST_SCENARIO,
  );

  // 3-4. Exactly 203 closed logical trades; every row must be closed.
  assertCount(selected.length, AUTHORIZED.closedTrades, 'closedTrades');
  for (const row of selected) {
    if (!colValue(trades, row, 'exit_time')) {
      throw new Error('A selected row is an open position and must not be treated as a closed trade.');
    }
    if (!colValue(trades, row, 'exit_reason')) {
      throw new Error('A selected row is missing its exit reason.');
    }
  }
  const exitReasons = new Map<string, number>();
  for (const row of selected) {
    const reason = colValue(trades, row, 'exit_reason');
    exitReasons.set(reason, (exitReasons.get(reason) ?? 0) + 1);
  }
  if (exitReasons.get('INITIAL_SL') !== 18 || exitReasons.get('OPPOSITE_TRIANGLE') !== 113 || exitReasons.get('TRAILING') !== 72) {
    throw new Error(`Unexpected exit-reason distribution: ${JSON.stringify([...exitReasons.entries()])}`);
  }

  // 5. Reconcile wins / losses / breakevens from the closed-trade net (points).
  const nets = selected.map((row) => numCol(trades, row, 'net_points'));
  const wins = nets.filter((v) => v > 0).length;
  const losses = nets.filter((v) => v < 0).length;
  const breakevens = nets.filter((v) => v === 0).length;
  assertCount(wins, AUTHORIZED.wins, 'wins');
  assertCount(losses, AUTHORIZED.losses, 'losses');
  assertCount(breakevens, AUTHORIZED.breakevens, 'breakevens');
  assertCount(wins + losses + breakevens, AUTHORIZED.closedTrades, 'wins+losses+breakevens');

  // 6-7. Gross profit / gross loss / net in points.
  const grossProfit = nets.filter((v) => v > 0).reduce((sum, v) => sum + v, 0);
  const grossLoss = nets.filter((v) => v < 0).reduce((sum, v) => sum + Math.abs(v), 0);
  const netSum = nets.reduce((sum, v) => sum + v, 0);
  assertClose(grossProfit, AUTHORIZED.grossProfitPoints, 'grossProfitPoints', 1e-6);
  assertClose(grossLoss, AUTHORIZED.grossLossPoints, 'grossLossPoints', 1e-6);
  const summaryNet = numCol(summary, summaryRow, 'net_points');
  assertClose(netSum, summaryNet, 'netPoints (vs summary)', 1e-6);
  assertClose(netSum, AUTHORIZED.netPoints, 'netPoints', 1e-6);

  // 7. Profit Factor: extracted from the summary and cross-checked from gross P&L.
  const profitFactor = numCol(summary, summaryRow, 'profit_factor');
  assertClose(profitFactor, AUTHORIZED.profitFactor, 'profitFactor', 1e-12);
  assertClose(profitFactor, grossProfit / grossLoss, 'profitFactor (gross ratio)', 1e-6);

  // QNT-0005C: public metrics are recomputed over the 203 CLOSED trades. The
  // source aggregate values (win_rate 50.0, expectancy 11.6115) divided by the
  // exported count of 204 (including the open position) and are kept only in
  // provenance notes, never as the main public metrics.
  const sourceWinRate = numCol(summary, summaryRow, 'win_rate');
  const sourceExpectancy = numCol(summary, summaryRow, 'expectancy');
  assertClose(sourceWinRate, AUTHORIZED.sourceWinRate, 'sourceWinRate', 1e-9);
  assertClose(sourceExpectancy, AUTHORIZED.sourceExpectancy, 'sourceExpectancy', 1e-9);
  const closedWinRate = (wins / AUTHORIZED.closedTrades) * 100;
  const closedExpectancy = netSum / AUTHORIZED.closedTrades;
  assertClose(closedWinRate, AUTHORIZED.winRate, 'winRate (102/203)', 1e-9);
  assertClose(closedExpectancy, AUTHORIZED.expectancyPoints, 'expectancyPoints (net/203)', 1e-9);

  // Open position: declared separately, never counted as a closed trade.
  const openAtEndSummary = colValue(summary, summaryRow, 'open_at_end');
  const openAtEndCoverage = colValue(coverage, coverageRow, 'open_at_end');
  if (openAtEndSummary !== 'true' || openAtEndCoverage !== 'true') {
    throw new Error(`Expected open_at_end=true, got summary=${openAtEndSummary} coverage=${openAtEndCoverage}`);
  }

  // 9. Equity: exactly the 203 closed-trade equity points (points; USD = NA).
  const points: EquityPoint[] = equity.rows.map((row) => ({
    timestamp: toNaive(colValue(equity, row, 'timestamp')),
    equity: numCol(equity, row, 'equity_points'),
    drawdown: numCol(equity, row, 'drawdown_points'),
  }));
  assertCount(points.length, AUTHORIZED.equityPoints, 'equityPoints');
  for (const point of points) {
    if (!Number.isFinite(point.equity) || !Number.isFinite(point.drawdown)) {
      throw new Error(`Non-finite equity point: ${JSON.stringify(point)}`);
    }
  }
  const equityMaxDrawdown = Math.max(...points.map((p) => p.drawdown ?? 0));
  const summaryDrawdown = numCol(summary, summaryRow, 'max_closed_trade_drawdown');
  assertClose(equityMaxDrawdown, summaryDrawdown, 'maxDrawdown (equity vs summary)', 1e-6);
  assertClose(summaryDrawdown, AUTHORIZED.maxDrawdownPoints, 'maxDrawdownPoints', 1e-6);

  // 13. Period reconciliations: DEVELOPMENT + VALIDATION + LOCKED_OOS = ALL = 203.
  const periodRows = periods.rows.filter(
    (row) => Number(colValue(periods, row, 'variant_id')) === FIRST_TRIANGLE_GOLD_VARIANT,
  );
  const byPeriod = new Map<string, { trades: number; net: number; pf: number; expectancy: number }>();
  for (const row of periodRows) {
    byPeriod.set(colValue(periods, row, 'period'), {
      trades: numCol(periods, row, 'trades'),
      net: numCol(periods, row, 'net_points'),
      pf: numCol(periods, row, 'profit_factor'),
      expectancy: numCol(periods, row, 'expectancy'),
    });
  }
  const dev = byPeriod.get('DEVELOPMENT');
  const val = byPeriod.get('VALIDATION');
  const oos = byPeriod.get('LOCKED_OOS');
  const all = byPeriod.get('ALL');
  if (!dev || !val || !oos || !all) {
    throw new Error(`Expected DEVELOPMENT/VALIDATION/LOCKED_OOS/ALL period rows, got ${[...byPeriod.keys()]}`);
  }
  assertCount(dev.trades, AUTHORIZED.development, 'DEVELOPMENT trades');
  assertCount(val.trades, AUTHORIZED.validation, 'VALIDATION trades');
  assertCount(oos.trades, AUTHORIZED.lockedOos, 'LOCKED_OOS trades');
  assertCount(dev.trades + val.trades + oos.trades, AUTHORIZED.closedTrades, 'DEV+VAL+OOS = closed');
  assertCount(all.trades, AUTHORIZED.closedTrades, 'ALL trades');
  assertClose(all.net, summaryNet, 'ALL net', 1e-6);
  assertClose(all.pf, profitFactor, 'ALL profitFactor', 1e-9);
  // Cross-check: the source's own ALL period row reports net/203 expectancy, which
  // must equal the closed-trade expectancy used as the public metric.
  const allExpectancy = all.expectancy;
  if (Math.abs(allExpectancy - closedExpectancy) > 1e-9) {
    throw new Error(`Closed expectancy must match the ALL period expectancy: ${allExpectancy}`);
  }

  // Monthly: 12 buckets with closed trades; 10 positive, 2 negative (reproducible from monthly.csv).
  const monthRows = monthly.rows.filter(
    (row) => Number(colValue(monthly, row, 'variant_id')) === FIRST_TRIANGLE_GOLD_VARIANT,
  );
  assertCount(monthRows.length, AUTHORIZED.monthlyRows, 'monthlyRows');
  const positiveMonths = monthRows.filter((row) => numCol(monthly, row, 'net_points') > 0).length;
  const negativeMonths = monthRows.filter((row) => numCol(monthly, row, 'net_points') < 0).length;
  assertCount(positiveMonths, AUTHORIZED.positiveMonths, 'positiveMonths');
  assertCount(negativeMonths, AUTHORIZED.negativeMonths, 'negativeMonths');

  // Frequency: ~15 closed trades per month over the analyzed period.
  const runStart = colValue(coverage, coverageRow, 'start_time');
  const runEnd = colValue(coverage, coverageRow, 'end_time');
  const startMs = Date.parse(toNaive(runStart));
  const endMs = Date.parse(toNaive(runEnd));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) throw new Error('Invalid coverage period.');
  const days = (endMs - startMs) / 86_400_000;
  const frequencyPerMonth = AUTHORIZED.closedTrades / (days / 30.4375);
  if (!(frequencyPerMonth > 14 && frequencyPerMonth < 16)) {
    throw new Error(`Frequency out of the ~15/month expected range: ${frequencyPerMonth}`);
  }

  // 17. No USD metric may be emitted (costs are not applied and USD is unavailable).
  // Public metrics are the CLOSED-trade values; source-aggregate values (which
  // counted 204, including the open position) never become public metrics.
  const metrics: Record<string, number> = {
    profitFactor,
    winRate: closedWinRate,
    trades: AUTHORIZED.closedTrades,
    wins,
    losses,
    breakevens,
    grossProfitPoints: grossProfit,
    grossLossPoints: grossLoss,
    netPoints: summaryNet,
    maxDrawdownPoints: summaryDrawdown,
    expectancyPoints: closedExpectancy,
    frequencyPerMonth,
    openPositionsAtEnd: AUTHORIZED.openPositionsAtEnd,
  };
  for (const key of Object.keys(metrics)) {
    if (key.endsWith('Usd')) throw new Error(`USD metric must never be emitted: ${key}`);
    if (key.startsWith('source')) throw new Error(`Source-only values must not be public metrics: ${key}`);
  }
  for (const value of Object.values(metrics)) {
    if (!Number.isFinite(value)) throw new Error(`Non-finite metric value: ${value}`);
  }

  const configRowValue = (name: string): string => colValue(config, configRow, name);
  const symbolRowValue = (name: string): string => colValue(symbol, symbolRow, name);

  const rules = [
    `Entry: First Triangle signal on M15 (${configRowValue('entry_model')})`,
    `Stop: fixed ${configRowValue('stop_points')} points (${configRowValue('stop_model')})`,
    `Trailing: activated after ${configRowValue('trailing_activation_points')} points, distance ${configRowValue('trailing_distance_points')} points`,
    `Exit: trailing stop or opposite triangle signal (${configRowValue('opposite_triangle_exit')})`,
    `Session: ${configRowValue('session')} · long ${configRowValue('buy_enabled')} · short ${configRowValue('sell_enabled')}`,
    `Modeling: ${configRowValue('tester_mode')}`,
  ];

  const description =
    'Historical backtest of the First Triangle Gold Adaptive model on XAUUSD (Gold vs US Dollar), M15. ' +
    'The model enters on the first triangle pattern, protects each position with a fixed stop, ' +
    'trails after a defined activation distance and exits by the trailing rule, an opposite triangle ' +
    'signal or the initial stop. Results are reconstructed from the owner\\u2019s supplied closed-trade ' +
    'history (203 closed trades, variant 174 of 378, BASE cost scenario) and are expressed in points, ' +
    'not USD. Costs were not applied in this export.';

  return {
    manifestVersion: '1.0',
    strategyId: FIRST_TRIANGLE_GOLD_ID,
    modelId: 'first-triangle-gold',
    performanceUnit: 'points',
    tagline: 'Rules-based triangle backtest on XAUUSD, expressed in points',
    type: 'Historical backtest',
    market: 'Gold',
    instrument: 'XAUUSD',
    // QNT-0003H: versioned publication contract (beta).
    publicationMode: 'results',
    filterVersion: 'beta-1',
    scoreVersion: 'beta-1',
    reviewLabel: 'Owner supplied',
    independentReproduction: false,
    costsApplied: false,
    sourceTimezone: null,
    timestampNormalization: 'not_normalized',
    rules,
    limitations: [
      'Historical backtest on XAUUSD (Gold vs US Dollar), M15, every tick based on real ticks.',
      'Results are expressed in points, not USD.',
      'Initial capital, timezone and broker server are unavailable.',
      '203 closed trades (variant 174 of 378, SL 55 / activation 60 / distance 25, BASE); 1 open position at end excluded from closed-trade metrics.',
      'Positive months in the supplied backtest: 10 of 12 months with closed trades (2 negative months).',
      'Source aggregate metrics used the exported count of 204 (including one open position); public closed-trade metrics were recomputed from the 203 closed trades.',
    ],
    costs: {
      status:
        'Costs not applied. The export reports commission 0.0 and slippage 0.0, but the source manifest warns that USD fields are unavailable until broker costs are reconciled — those zeros are not confirmed real costs.',
    },
    variant: `Variant ${FIRST_TRIANGLE_GOLD_VARIANT} of ${String(sourceManifest.total_variants ?? '378')} (SL55_ACT60_DIST25_BASE)`,
    configuration: 'SL 55 / activation 60 / distance 25 · M15 · Every tick based on real ticks',
    disclaimer:
      'Historical results calculated from the available data. Past performance does not guarantee future results.',
    evidence: [
      {
        file: `${EVIDENCE_REL}/first_triangle_gold_manifest.json`,
        kind: 'manifest',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_gold_manifest.json')),
        note: 'Source identity, selected variant and warnings (verbatim)',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_gold_strategy_config.csv`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_gold_strategy_config.csv')),
        note: 'Strategy configuration and rules',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_gold_symbol_specifications.csv`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_gold_symbol_specifications.csv')),
        note: 'Broker/symbol specifications',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_gold_coverage.csv`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_gold_coverage.csv')),
        note: 'Period and open-at-end declaration',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_gold_summary.csv`,
        kind: 'summary',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_gold_summary.csv')),
        note: 'Closed-run summary metrics per variant (points)',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_gold_trades.csv`,
        kind: 'trades',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_gold_trades.csv')),
        note: 'Closed-trade log for all 378 variants (points)',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_gold_equity.csv`,
        kind: 'equity',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_gold_equity.csv')),
        note: '203 closed-trade equity points (points)',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_gold_monthly.csv`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_gold_monthly.csv')),
        note: 'Monthly buckets per variant',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_gold_periods.csv`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_gold_periods.csv')),
        note: 'DEVELOPMENT/VALIDATION/LOCKED_OOS/H1/H2/ALL per variant',
      },
      {
        file: `${EVIDENCE_REL}/first_triangle_gold_robustness_surface.csv`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'first_triangle_gold_robustness_surface.csv')),
        note: '378-variant robustness surface (research evidence, not public)',
      },
      {
        file: `${EVIDENCE_REL}/source-archive.sha256`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'source-archive.sha256')),
        note: 'SHA-256 of the original OROM15.zip archive',
      },
    ],
    results: {
      period: { start: toNaive(runStart), end: toNaive(runEnd), timeframe: 'M15' },
      metrics,
      equity: points,
      evidenceComplete: 1,
    },
    dataset: {
      modelVersion: '1.0',
      strategies: [
        {
          id: FIRST_TRIANGLE_GOLD_ID,
          name: 'First Triangle Gold Adaptive',
          description,
          version: '3.00',
          status: 'active',
          validationStatus: 'owner_supplied_under_review',
          assetIds: ['xauusd'],
          backtestIds: [],
          createdAt: '2025-07-01T00:00:00Z',
          updatedAt: '2025-07-01T00:00:00Z',
          provenance: {
            dataStatus: 'real',
            sourceName: 'First Triangle Gold Adaptive (owner delivery)',
            sourceType: 'owner-delivery',
            receivedAt: '2025-07-01T00:00:00Z',
            sourceFile: 'OROM15.zip',
            notes:
              'Source: data/quantora-real-backtests @ 2dc5733bf3c2d0c5fe549d418530f6ce70644ecf, ' +
              'data/imports/quantora-real-backtests/OROM15.zip, SHA-256 ' +
              '816812315e82e067b2dfd42144b722c2cc73b231e674398a6bb71f2e05467476. ' +
              'Run id FIRST_TRIANGLE_GOLD_EVIDENCE_XAUUSD_1751328000 (source run timestamp 2025-07-01; ' +
              'sourceTimezone unknown, timestamps kept naive and not normalized). ' +
              'Model id first-triangle-gold. Selected variant 174 of 378 (SL55_ACT60_DIST25_BASE). ' +
              'Source aggregate used exported count 204, including one open position (source win rate 50.0%, ' +
              'source expectancy 11.6115 pts/trade). Public closed-trade metrics were recomputed from the 203 ' +
              'closed trades (win rate 50.2463%, expectancy 11.6687 pts/trade). ' +
              'createdAt/updatedAt reflect the source run timestamp; no separate delivery timestamp was provided.',
          },
        },
      ],
      assets: [
        {
          id: 'xauusd',
          symbol: symbolRowValue('symbol'),
          name: 'Gold',
          assetClass: 'forex',
          exchange: symbolRowValue('broker'),
          quoteCurrency: symbolRowValue('currency_profit'),
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
  writeFileSync(FIRST_TRIANGLE_GOLD_MANIFEST_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

function sortMetrics(metrics: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!metrics) return undefined;
  const out: Record<string, number> = {};
  for (const key of Object.keys(metrics).sort()) out[key] = metrics[key]!;
  return out;
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('ingest-first-triangle-gold.ts') || entry.endsWith('ingest-first-triangle-gold')) {
  const manifest = buildFirstTriangleGoldManifest();
  writeManifest(manifest);
  console.log(`Manifest written to ${FIRST_TRIANGLE_GOLD_MANIFEST_PATH}`);
  const m = manifest.results?.metrics;
  console.log(
    `First Triangle Gold Adaptive: ${m?.trades} closed trades (${m?.wins}W/${m?.losses}L/${m?.breakevens}B), PF ${m?.profitFactor?.toFixed(5)}, net ${m?.netPoints?.toFixed(2)} pts, drawdown ${m?.maxDrawdownPoints?.toFixed(2)} pts, open at end ${m?.openPositionsAtEnd}`,
  );
}
