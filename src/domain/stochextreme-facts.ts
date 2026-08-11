/**
 * V2B — Owner-supplied strategy facts for StochExtreme Adaptive.
 *
 * These are the exact, verbatim truths delivered by the owner for the
 * StochExtreme backtest (v1.07 filtered). They are aggregate descriptors and
 * structural rules ONLY — no per-trade rows, no equity series. The per-trade
 * CSVs (trades.csv, equity.csv, manifest.csv, coverage.csv,
 * strategy_config.csv, events.csv, symbol_specifications.csv) have NOT been
 * delivered to the repository yet, so curves/logs/heatmaps render an honest
 * pending state, never an invented shape, and never a "mock" label on these
 * real historical aggregates.
 *
 * Source status (verified 2026-08): the seven CSV datasets named in the brief
 * were searched for across the workspace and the linked repository and are
 * absent. When the owner delivers them, the import path in
 * `src/domain/csv-import.ts` + `src/domain/analytics.ts` populates the series
 * without any UI change.
 */

export type StochExtremeFacts = {
  version: string;
  symbol: string;
  periodStart: string;
  periodEnd: string;
  tradeCount: number;
  netProfitUsd: number;
  profitFactor: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  structuralWin: number;
  structuralLoss: number;
  ticksProcessed: number;
  powerScore: number;
  /** Allowed trading hours (US Eastern). */
  allowedHours: { start: string; end: string }[];
  /** Excluded (no-trade) hours (US Eastern). */
  excludedHours: { start: string; end: string }[];
  /** Structural WIN rule. */
  winRule: string;
  /** Structural LOSS rule. */
  lossRule: string;
  /** Definitive stop distance (USTEC points). */
  stopPoints: number;
  positioning: string;
  /** Short description used on the detail page. */
  description: string;
  /** "Specialist in sideways markets" fit note. */
  fitNote: string;
};

export const STOCHEXTREME_FACTS: StochExtremeFacts = {
  version: 'v1.07 filtered',
  symbol: 'USTEC',
  periodStart: '2025-08-01',
  periodEnd: '2026-08-07',
  tradeCount: 421,
  netProfitUsd: 6582,
  profitFactor: 1.1514,
  maxDrawdownUsd: 4690,
  maxDrawdownPct: 26.53,
  structuralWin: 200,
  structuralLoss: 221,
  ticksProcessed: 509489041,
  powerScore: 6.1,
  allowedHours: [
    { start: '03:00', end: '11:30' },
    { start: '14:00', end: '18:00' },
  ],
  excludedHours: [
    { start: '11:30', end: '14:00' },
    { start: '18:00', end: '03:00' },
  ],
  winRule: 'BUY counts as a structural WIN only when K ≥ 80; SELL counts as a structural WIN only when K ≤ 20.',
  lossRule: 'A structural LOSS is recorded only on a definitive stop touch (USTEC, 100 points).',
  stopPoints: 100,
  positioning: 'Specialist in sideways markets',
  description:
    'A stochastic mean-reversion system specialized in sideways markets. It trades extreme overbought and oversold zones on USTEC, adapting its thresholds to recent volatility and respecting a strict intraday session filter. Structural outcome (WIN/LOSS by rule) is tracked separately from economic result (post-cost P&L), because a structural WIN can still close negative after execution costs.',
  fitNote:
    'Best suited to sideways, range-bound USTEC sessions within the allowed ET windows; not a trend-following or breakout system.',
};

/**
 * Honest evidence-status note shared by the UI: the seven CSV datasets named
 * in the brief are not present in the repository, so series-dependent modules
 * (equity curve, drawdown, monthly heatmap, trade log) render a neutral
 * pending state. Aggregate metrics are owner-supplied and shown verbatim.
 */
export const STOCHEXTREME_DATASET_STATUS =
  'Pending dataset delivery: trades.csv, equity.csv, manifest.csv, coverage.csv, strategy_config.csv, events.csv and symbol_specifications.csv are not present in the repository. Aggregate metrics below are owner-supplied and shown verbatim; the equity curve, drawdown, monthly heatmap and trade log will populate when the per-trade series arrive.';
