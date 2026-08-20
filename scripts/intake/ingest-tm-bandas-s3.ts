/**
 * QNT-0007 TM Bandas S3 importer.
 *
 * Reads the committed private derivatives under
 * `strategy-intake/evidence/tm-bandas-s3/` (originally extracted verbatim from
 * `bandas.zip`, branch `data/quantora-real-backtests`, commit `24c1619`) and
 * produces the versioned strategy manifest at
 * `public-strategies/manifests/tm-bandas-s3.manifest.json`.
 *
 * The source export is a single selected variant (`KEEPER_SL12_TP36`): 621
 * closed trades on USTEC (Nasdaq-100 CFD, IC Markets), M1, short-only. There is
 * no separate equity file, so the closed-trade equity curve is reconstructed by
 * cumulating `net_pnl` over the closed trades in chronological order from the
 * declared initial capital. Costs are recorded as `0.00` in the export with
 * `costs_included=false`, so `costsApplied` is explicitly false and the 0.00 is
 * never read as a confirmed real cost.
 *
 * The importer self-checks every extracted figure against the authorized source
 * summary and throws on any drift, so ingestion is reproducible.
 *
 * Run: bun run strategies:ingest:tm-bandas-s3
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import type { EquityPoint } from '../../src/domain/types.ts';
import type { Manifest } from './manifest.ts';
import { sha256File } from './pipeline.ts';

const ROOT = process.cwd();
const EVIDENCE_DIR = resolve(ROOT, 'strategy-intake/evidence/tm-bandas-s3');
export const TM_BANDAS_S3_MANIFEST_PATH = resolve(
  ROOT,
  'public-strategies/manifests/tm-bandas-s3.manifest.json',
);

const EVIDENCE_REL = '../../strategy-intake/evidence/tm-bandas-s3';

/** Authorized source archive digest (bandas.zip @ data branch 24c1619). */
export const AUTHORIZED_SOURCE_SHA256 =
  '455294f995ede782880b847755828dc07e2b0ef4642040bca754c49f30b67f21';

export const STRATEGY_ID = 'tm-bandas-s3';
const SOURCE_VARIANT = 'KEEPER_SL12_TP36';

// ---------------------------------------------------------------------------
// Robust RFC-4180-style CSV parser (quoted fields, commas in text, CRLF/LF,
// escaped quotes, empty values, UTF-8). No naive split(',') is used.
// ---------------------------------------------------------------------------

type Csv = { headers: string[]; rows: string[][] };

function parseCsv(text: string): Csv {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      field = '';
      records.push(row);
      row = [];
      continue;
    }
    if (ch === '\r') continue; // CR in CRLF line endings
    field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const rows = records.filter(
    (record) => record.length > 0 && !(record.length === 1 && record[0]!.trim() === ''),
  );
  if (rows.length < 2) throw new Error('CSV must contain a header and at least one row.');
  return { headers: rows[0]!, rows: rows.slice(1) };
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
  if (!Number.isFinite(actual)) throw new Error(`${label}: got non-finite value ${actual}`);
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertCount(actual: number, expected: number, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function assertEqual(actual: string, expected: string, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected "${expected}", got "${actual}"`);
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

// ---------------------------------------------------------------------------
// Manifest construction
// ---------------------------------------------------------------------------

export function buildTmBandasS3Manifest(evidenceDir: string = EVIDENCE_DIR): Manifest {
  const read = (name: string): string => readFileSync(join(evidenceDir, name), 'utf8');

  // 1. Verify the source archive digest recorded alongside the derivatives.
  const shaRecord = read('source-archive.sha256').trim();
  const shaParts = shaRecord.split(/\s+/);
  if (shaParts.length < 2 || shaParts[1] !== 'bandas.zip') {
    throw new Error('source-archive.sha256 must record the bandas.zip digest.');
  }
  if (shaParts[0]!.toLowerCase() !== AUTHORIZED_SOURCE_SHA256) {
    throw new Error('source-archive.sha256 does not match the authorized bandas.zip SHA-256.');
  }

  const manifestCsv = parseCsv(read('bandas_manifest.csv'));
  const paramsCsv = parseCsv(read('bandas_parameters.csv'));
  const tradesCsv = parseCsv(read('bandas_trades.csv'));
  const summaryCsv = parseCsv(read('bandas_summary.csv'));
  const monthlyCsv = parseCsv(read('bandas_monthly.csv'));
  const validationCsv = parseCsv(read('bandas_validation.csv'));
  const writeTestCsv = parseCsv(read('bandas_write_test.csv'));

  const mRow = manifestCsv.rows[0];
  const pRow = paramsCsv.rows[0];
  const sRow = summaryCsv.rows[0];
  if (!mRow || !pRow || !sRow) throw new Error('Source CSVs must each contain a data row.');

  // --- Identity / environment (from bandas_manifest.csv) ---
  const sourceStrategyId = colValue(manifestCsv, mRow, 'strategy_id'); // variant-qualified
  const strategyVersion = colValue(manifestCsv, mRow, 'strategy_version');
  const runId = colValue(manifestCsv, mRow, 'run_id');
  const symbol = colValue(manifestCsv, mRow, 'symbol');
  const timeframe = colValue(manifestCsv, mRow, 'timeframe');
  const lotSize = numCol(manifestCsv, mRow, 'lot_size');
  const moneyPerIndexPoint = numCol(manifestCsv, mRow, 'money_per_index_point');
  const initialCapital = numCol(manifestCsv, mRow, 'initial_capital');
  const entryLogic = colValue(manifestCsv, mRow, 'entry_logic');
  const variant = colValue(manifestCsv, mRow, 'variant');
  const opensRealOrders = colValue(manifestCsv, mRow, 'opens_real_orders');
  const startUtc = colValue(manifestCsv, mRow, 'start_utc');
  const endUtc = colValue(manifestCsv, mRow, 'end_utc');
  const notes = colValue(manifestCsv, mRow, 'notes');

  assertEqual(sourceStrategyId, 'tm-bandas-s3-keeper', 'source strategy_id');
  assertEqual(variant, SOURCE_VARIANT, 'variant');
  assertEqual(symbol, 'USTEC', 'symbol');
  assertEqual(timeframe, 'M1', 'timeframe');
  assertEqual(opensRealOrders, 'false', 'opens_real_orders');

  // --- Summary (bandas_summary.csv) ---
  const summaryVariant = colValue(summaryCsv, sRow, 'variant');
  const summaryInitialCapital = numCol(summaryCsv, sRow, 'initial_capital');
  const summaryFinalBalance = numCol(summaryCsv, sRow, 'final_balance');
  const summaryNetProfit = numCol(summaryCsv, sRow, 'net_profit');
  const summaryClosedTrades = numCol(summaryCsv, sRow, 'closed_trades');
  const summaryWinners = numCol(summaryCsv, sRow, 'winners');
  const summaryLosers = numCol(summaryCsv, sRow, 'losers');
  const summaryWinRate = numCol(summaryCsv, sRow, 'win_rate');
  const summaryProfitFactor = numCol(summaryCsv, sRow, 'profit_factor');
  const summaryMaxDrawdownAmount = numCol(summaryCsv, sRow, 'max_drawdown_amount');
  const summaryCommissionTotal = numCol(summaryCsv, sRow, 'commission_total');
  const summaryFeesTotal = numCol(summaryCsv, sRow, 'fees_total');
  const summaryOpenAtEnd = numCol(summaryCsv, sRow, 'open_at_end');

  assertEqual(summaryVariant, SOURCE_VARIANT, 'summary variant');
  assertClose(initialCapital, summaryInitialCapital, 'initial capital', 1e-9);

  // --- Trades: only closed trades, one variant, costs never applied ---
  for (const row of tradesCsv.rows) {
    const rowVariant = colValue(tradesCsv, row, 'variant');
    const rowStatus = colValue(tradesCsv, row, 'status');
    const rowCosts = colValue(tradesCsv, row, 'costs_included');
    if (rowVariant !== SOURCE_VARIANT) {
      throw new Error(`Trade ${colValue(tradesCsv, row, 'trade_id')} belongs to variant "${rowVariant}".`);
    }
    if (rowStatus !== 'closed') {
      throw new Error(`Trade ${colValue(tradesCsv, row, 'trade_id')} has status "${rowStatus}", not closed.`);
    }
    if (rowCosts !== 'false') {
      throw new Error(`Trade ${colValue(tradesCsv, row, 'trade_id')} has costs_included=${rowCosts}.`);
    }
  }

  const tradeCount = tradesCsv.rows.length;
  const nets = tradesCsv.rows.map((row) => numCol(tradesCsv, row, 'net_pnl'));
  for (const value of nets) {
    if (!Number.isFinite(value)) throw new Error('Trade net_pnl contains NaN or Infinity.');
  }
  const winners = nets.filter((value) => value > 0).length;
  const losers = nets.filter((value) => value < 0).length;
  const breakevens = nets.filter((value) => value === 0).length;
  const grossProfit = nets.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = nets.filter((value) => value < 0).reduce((sum, value) => sum + Math.abs(value), 0);
  const net = nets.reduce((sum, value) => sum + value, 0);
  const profitFactor = grossProfit / grossLoss;
  const winRate = (winners / tradeCount) * 100;
  const expectancyUsd = net / tradeCount;

  // Sides: the system is short-only.
  const sides = new Set(tradesCsv.rows.map((row) => colValue(tradesCsv, row, 'side')));
  if (sides.size !== 1 || !sides.has('sell')) {
    throw new Error(`Expected a short-only trade log, got sides: ${[...sides].join(',')}`);
  }

  // --- Reconcile closed-trade metrics against the source summary ---
  assertCount(tradeCount, 621, 'tradeCount');
  assertCount(winners, 228, 'winners');
  assertCount(losers, 393, 'losers');
  assertCount(breakevens, 0, 'breakevens');
  assertCount(winners + losers + breakevens, tradeCount, 'wins+losses+breakevens');
  assertClose(profitFactor, summaryProfitFactor, 'profitFactor', 1e-7);
  assertClose(winRate, summaryWinRate * 100, 'winRate', 1e-6);
  assertClose(grossProfit, 16416.0, 'grossProfit', 0.01);
  assertClose(grossLoss, 9432.0, 'grossLoss', 0.01);
  assertClose(net, summaryNetProfit, 'net', 0.01);
  assertClose(net, 6984.0, 'net (authorized)', 0.01);
  assertClose(expectancyUsd, 11.246376811594203, 'expectancyUsd', 1e-9);
  assertCount(summaryClosedTrades, 621, 'summary closed_trades');
  assertCount(summaryWinners, 228, 'summary winners');
  assertCount(summaryLosers, 393, 'summary losers');
  assertCount(summaryOpenAtEnd, 0, 'open_at_end');

  // Costs: recorded as 0.00 but costs_included=false → NOT confirmed real costs.
  const commissions = new Set(tradesCsv.rows.map((row) => numCol(tradesCsv, row, 'commission')));
  const fees = new Set(tradesCsv.rows.map((row) => numCol(tradesCsv, row, 'fees')));
  if (commissions.size !== 1 || fees.size !== 1) {
    throw new Error('Expected uniform commission/fees values in the trade log.');
  }
  assertClose([...commissions][0]!, 0.0, 'commission', 1e-9);
  assertClose([...fees][0]!, 0.0, 'fees', 1e-9);
  assertClose(summaryCommissionTotal, 0.0, 'summary commission_total', 1e-9);
  assertClose(summaryFeesTotal, 0.0, 'summary fees_total', 1e-9);

  // --- Equity: reconstruct closed-trade equity (no source equity file) ---
  const chronological = [...tradesCsv.rows].sort((a, b) => {
    const aExit = colValue(tradesCsv, a, 'exit_time');
    const bExit = colValue(tradesCsv, b, 'exit_time');
    if (aExit !== bExit) return aExit < bExit ? -1 : 1;
    return colValue(tradesCsv, a, 'trade_id').localeCompare(colValue(tradesCsv, b, 'trade_id'));
  });

  let equity = initialCapital;
  let peak = initialCapital;
  let maxDrawdown = 0;
  const points: EquityPoint[] = chronological.map((row) => {
    const netPnL = numCol(tradesCsv, row, 'net_pnl');
    equity += netPnL;
    if (equity > peak) peak = equity;
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    return {
      timestamp: colValue(tradesCsv, row, 'exit_time'),
      equity: round2(equity),
      drawdown: round2(drawdown),
    };
  });

  if (points.length !== tradeCount) throw new Error('Equity point count must match the trade count.');
  assertClose(maxDrawdown, summaryMaxDrawdownAmount, 'maxDrawdown', 0.01);
  assertClose(maxDrawdown, 384.0, 'maxDrawdown (authorized)', 0.01);
  assertClose(equity, summaryFinalBalance, 'final balance', 0.01);
  assertClose(equity, initialCapital + net, 'final balance vs net', 0.01);

  // --- Monthly reconciliation ---
  const monthlyTradeCount = monthlyCsv.rows.reduce((sum, row) => sum + numCol(monthlyCsv, row, 'trade_count'), 0);
  const monthlyWinners = monthlyCsv.rows.reduce((sum, row) => sum + numCol(monthlyCsv, row, 'winners'), 0);
  const monthlyLosers = monthlyCsv.rows.reduce((sum, row) => sum + numCol(monthlyCsv, row, 'losers'), 0);
  const monthlyNet = monthlyCsv.rows.reduce((sum, row) => sum + numCol(monthlyCsv, row, 'net_pnl'), 0);
  assertCount(monthlyTradeCount, 621, 'monthly trade count');
  assertCount(monthlyWinners, 228, 'monthly winners');
  assertCount(monthlyLosers, 393, 'monthly losers');
  assertClose(monthlyNet, net, 'monthly net', 0.01);

  // --- Source self-checks + write test ---
  for (const row of validationCsv.rows) {
    const status = colValue(validationCsv, row, 'status');
    if (status !== 'pass') {
      throw new Error(
        `Validation check ${colValue(validationCsv, row, 'check_id')} (${colValue(validationCsv, row, 'name')}) failed with status "${status}".`,
      );
    }
  }
  const writeStatus = colValue(writeTestCsv, writeTestCsv.rows[0]!, 'status');
  assertEqual(writeStatus, 'WRITE_OK', 'write test status');

  // --- Period + frequency ---
  const firstEntry = colValue(tradesCsv, tradesCsv.rows[0]!, 'entry_time');
  const lastExit = colValue(tradesCsv, chronological[chronological.length - 1]!, 'exit_time');
  const firstMs = Date.parse(firstEntry);
  const lastMs = Date.parse(lastExit);
  if (!Number.isFinite(firstMs) || !Number.isFinite(lastMs)) {
    throw new Error('Invalid trade timestamps.');
  }
  const days = (lastMs - firstMs) / 86_400_000;
  const frequencyPerMonth = tradeCount / (days / 30.4375);

  const metrics: Record<string, number> = {
    profitFactor,
    winRate,
    trades: tradeCount,
    wins: winners,
    losses: losers,
    breakevens,
    frequencyPerMonth,
    maxDrawdownUsd: maxDrawdown,
    netUsd: net,
    expectancyUsd,
    grossProfit,
    grossLoss,
    openPositionsAtEnd: summaryOpenAtEnd,
    initialCapital,
    closedTradeDrawdownDecimal: maxDrawdown / initialCapital,
  };

  const params = Object.fromEntries(
    paramsCsv.rows.map((row) => [colValue(paramsCsv, row, 'parameter'), colValue(paramsCsv, row, 'value')]),
  ) as Record<string, string>;

  const rules = [
    `Entry: ${entryLogic} — sell when price is above the upper rail (short-only)`,
    `Rails: period ${params['RailPeriod']} (shift ${params['RailShift']}) · ATR ${params['ATRPeriod']} · ATR range ${params['ATRMin']}–${params['ATRMax']} · minimum rail gap ${params['MinRailGap']}`,
    'Stop: 12 points (SL12)',
    'Target: 36 points (TP36)',
    `Timeframe: ${timeframe} · ${lotSize} lots · ${moneyPerIndexPoint} USD per index point`,
    'Research explorer — does not open real orders',
  ];

  const description =
    'Historical backtest of a band-based mean-reversion model on the Nasdaq-100 index CFD (USTEC) at IC Markets. ' +
    'The model enters short when price moves above the upper rail, protects each position with a 12-point stop and ' +
    'exits at a 36-point target (KEEPER_SL12_TP36 variant). It is a research explorer: it analyzes historical data ' +
    'and does not open real orders. Results are reconstructed from the owner\u2019s supplied closed-trade history (621 closed trades).';

  return {
    manifestVersion: '1.0',
    strategyId: STRATEGY_ID,
    tagline: 'Band-based mean-reversion model on Nasdaq-100 (USTEC)',
    type: 'Historical backtest',
    market: 'Nasdaq-100',
    instrument: 'USTEC',
    publicationMode: 'results',
    filterVersion: 'beta-1',
    scoreVersion: 'beta-1',
    reviewLabel: 'Owner supplied',
    independentReproduction: false,
    costsApplied: false,
    rules,
    limitations: [
      'Historical backtest on Nasdaq-100 (USTEC) M1, IC Markets',
      'Results are expressed in USD',
      'Costs were not applied to this export (costs_included=false; commission/fees 0.00 are not confirmed real costs)',
      '621 closed trades, short-only (all sell)',
      'Maximum closed-trade drawdown: 384.00 USD',
      'Equity is reconstructed from closed trades (no separate equity file)',
      'No walk-forward / out-of-sample split is declared',
      'Owner-supplied evidence; independent reproduction pending',
      'Past performance does not guarantee future results',
    ],
    costs: {
      commission: '0.00 USD per trade (not applied in this export)',
      fees: '0.00 USD per trade (not applied in this export)',
    },
    variant: `${SOURCE_VARIANT} (short-only)`,
    configuration: `${SOURCE_VARIANT} / ${timeframe} / SL 12 pts / TP 36 pts`,
    disclaimer:
      'Historical results calculated from the available data. Past performance does not guarantee future results.',
    evidence: [
      {
        file: `${EVIDENCE_REL}/bandas_write_test.csv`,
        kind: 'other',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'bandas_write_test.csv')),
        note: 'Export write/format self-test (WRITE_OK)',
      },
      {
        file: `${EVIDENCE_REL}/bandas_manifest.csv`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'bandas_manifest.csv')),
        note: 'Run metadata and unit specification',
      },
      {
        file: `${EVIDENCE_REL}/bandas_parameters.csv`,
        kind: 'source',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'bandas_parameters.csv')),
        note: 'Strategy parameters',
      },
      {
        file: `${EVIDENCE_REL}/bandas_trades.csv`,
        kind: 'trades',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'bandas_trades.csv')),
        note: 'Closed-trade log (621 trades)',
      },
      {
        file: `${EVIDENCE_REL}/bandas_summary.csv`,
        kind: 'summary',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'bandas_summary.csv')),
        note: 'Closed-run summary metrics',
      },
      {
        file: `${EVIDENCE_REL}/bandas_monthly.csv`,
        kind: 'summary',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'bandas_monthly.csv')),
        note: 'Monthly breakdown (12 months)',
      },
      {
        file: `${EVIDENCE_REL}/bandas_validation.csv`,
        kind: 'other',
        classification: 'private',
        sha256: sha256File(join(evidenceDir, 'bandas_validation.csv')),
        note: 'Source self-checks (all pass)',
      },
    ],
    results: {
      period: { start: firstEntry, end: lastExit, timeframe },
      metrics,
      equity: points,
      evidenceComplete: 1,
    },
    dataset: {
      modelVersion: '1.0',
      strategies: [
        {
          id: STRATEGY_ID,
          name: 'TM Bandas S3',
          description,
          version: strategyVersion,
          status: 'active',
          validationStatus: 'owner_supplied_under_review',
          assetIds: ['ustec'],
          backtestIds: [],
          createdAt: '2025-07-01T00:00:00Z',
          updatedAt: '2025-07-01T00:00:00Z',
          provenance: {
            dataStatus: 'real',
            sourceName: 'TM Bandas S3 (owner delivery)',
            sourceType: 'owner-delivery',
            receivedAt: '2025-07-01T00:00:00Z',
            sourceFile: 'bandas.zip',
            notes:
              'Source: data/quantora-real-backtests @ 24c161929325679bbf6f14a0a079b331a2cd7f5e, ' +
              'data/imports/quantora-real-backtests/bandas.zip. ' +
              `Source manifest data window: ${startUtc} → ${endUtc}. ` +
              `Source run id "${runId}" (epoch 1751328000 → 2025-07-01 used for createdAt/updatedAt; no separate delivery timestamp). ` +
              `Source declared strategy_id "${sourceStrategyId}" (variant-qualified); stable system id is "${STRATEGY_ID}". ` +
              `Source notes: "${notes}". ` +
              'Source timestamps carry an explicit +00:00 offset (UTC as declared by the export) and are preserved verbatim.',
          },
        },
      ],
      assets: [
        {
          id: 'ustec',
          symbol: 'USTEC',
          name: 'Nasdaq-100',
          assetClass: 'other',
          exchange: 'IC Markets',
          quoteCurrency: 'USD',
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
  writeFileSync(TM_BANDAS_S3_MANIFEST_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

function sortMetrics(metrics: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!metrics) return undefined;
  const out: Record<string, number> = {};
  for (const key of Object.keys(metrics).sort()) out[key] = metrics[key]!;
  return out;
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('ingest-tm-bandas-s3.ts') || entry.endsWith('ingest-tm-bandas-s3')) {
  const manifest = buildTmBandasS3Manifest();
  writeManifest(manifest);
  console.log(`Manifest written to ${TM_BANDAS_S3_MANIFEST_PATH}`);
  console.log(
    `TM Bandas S3: ${manifest.results?.metrics?.trades} trades, PF ${manifest.results?.metrics?.profitFactor?.toFixed(5)}, net $${manifest.results?.metrics?.netUsd?.toFixed(2)}`,
  );
}
