/**
 * V2B — Normalized, typed performance-analytics layer.
 *
 * This module is the single reusable source of truth for backtest analytics.
 * It is intentionally pure (no React, no DOM) so it can be unit-tested and
 * shared by the detail page, the publish-wizard preview, the admin evidence
 * view and any future backend adapter.
 *
 * Honesty contract:
 *  - Nothing is invented. When the underlying series are empty, calculations
 *    return `undefined` rather than a fabricated number, and the UI shows an
 *    honest neutral state — never a fake curve and never a "mock" label on
 *    real historical aggregates.
 *  - Owner-supplied aggregate metrics (profit factor, trade count, net P&L,
 *    drawdown, ticks) are passed through verbatim; they are NOT recomputed
 *    from series the owner has not delivered.
 *  - The structural vs. economic distinction is explicit: structural outcome
 *    counts (WIN/LOSS by rule) are separated from economic result (post-cost
 *    P&L) because a structural WIN can still lose money after costs.
 */

export type TradeSide = 'buy' | 'sell';
export type StructuralOutcome = 'win' | 'loss';

/** A single normalized trade row (from trades.csv or JSON). */
export type NormalizedTrade = {
  id: string;
  side: TradeSide;
  openedAt: string; // ISO-8601
  closedAt?: string; // ISO-8601
  symbol: string;
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  pnlUsd?: number;
  feesUsd?: number;
  /** Structural outcome by the strategy rule (e.g. K>=80 BUY WIN), not the economic result. */
  structural?: StructuralOutcome;
  /** Optional source-provided R multiple; never inferred from USD P&L. */
  rMultiple?: number;
  /** Source-provided exit context, shown as evidence tooltip. */
  exitReason?: string;
  riskPoints?: number;
};

/** A point on the equity / drawdown series (from equity.csv). */
export type EquityPoint = {
  timestamp: string; // ISO-8601
  equity: number;
  balance?: number;
  drawdownUsd?: number;
  drawdownPct?: number;
};

export type EquitySeries = EquityPoint[];
export type DrawdownSeries = EquityPoint[]; // same shape, used for the DD chart
export type BalanceSeries = EquityPoint[];

/** One month bucket for the heatmap. */
export type MonthlyBucket = {
  year: number;
  month: number; // 0-11
  pnlUsd: number;
  trades: number;
  wins: number;
  losses: number;
};

export type MonthlyReturns = MonthlyBucket[];

export type StructuralMetrics = {
  winCount: number;
  lossCount: number;
  total: number;
  winRate: number; // 0-1
  /** Rule text, e.g. "BUY WIN only when K>=80; SELL WIN only when K<=20". */
  winRule: string;
  /** Rule text, e.g. "LOSS only on definitive USTEC 100-point stop touch". */
  lossRule: string;
};

export type EconomicMetrics = {
  netProfitUsd?: number;
  profitFactor?: number;
  /** Average P&L per operation, post-cost. */
  avgPerTradeUsd?: number;
  grossProfitUsd?: number;
  grossLossUsd?: number;
};

export type DurationMetrics = {
  avgDurationMinutes?: number;
  shortestMinutes?: number;
  longestMinutes?: number;
};

export type DirectionMetrics = {
  buyCount: number;
  sellCount: number;
  buyPnlUsd?: number;
  sellPnlUsd?: number;
};

export type ConcentrationMetrics = {
  /** Top-N symbols/days by absolute P&L contribution. */
  top5: { label: string; pnlUsd: number; trades: number }[];
  top10: { label: string; pnlUsd: number; trades: number }[];
  /** Largest single winning and losing trade. */
  bestTradeUsd?: number;
  worstTradeUsd?: number;
};

export type StreakMetrics = {
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: number; // positive = wins, negative = losses, 0 = none
};

/** Metadata describing where the evidence came from and its completeness. */
export type EvidenceMetadata = {
  /** "real" when sourced from an owner delivery, never "mock" for historicals. */
  status: 'real' | 'pending';
  sourceLabel: string; // e.g. "Historical Backtest" (neutral), "Owner Supplied" (discrete)
  sourceFile?: string;
  receivedAt?: string;
  /** True when the per-trade / equity series are present and can be charted. */
  hasSeries: boolean;
  notes?: string;
};

/** The full normalized analytics bundle for one strategy backtest. */
export type StrategyAnalytics = {
  strategyId: string;
  evidence: EvidenceMetadata;
  equity?: EquitySeries;
  drawdown?: DrawdownSeries;
  trades?: NormalizedTrade[];
  monthly?: MonthlyReturns;
  structural?: StructuralMetrics;
  economic?: EconomicMetrics;
  duration?: DurationMetrics;
  direction?: DirectionMetrics;
  concentration?: ConcentrationMetrics;
  streaks?: StreakMetrics;
};

export const HISTORICAL_BACKTEST_LABEL = 'Historical Backtest';
export const OWNER_SUPPLIED_LABEL = 'Owner Supplied';
export const PERFORMANCE_DISCLAIMER =
  'Historical results do not predict future performance.';

/* --------------------------------------------------------------------------
 * Pure calculation helpers — all return `undefined` when data is insufficient
 * so the UI can render an honest neutral state instead of a fake number.
 * ------------------------------------------------------------------------ */

const isFiniteNum = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

export function sum(values: number[]): number {
  let acc = 0;
  for (const v of values) if (isFiniteNum(v)) acc += v;
  return acc;
}

export function mean(values: number[]): number | undefined {
  const finite = values.filter(isFiniteNum);
  if (!finite.length) return undefined;
  return sum(finite) / finite.length;
}

/** Convert ISO timestamps to minutes between open and close. */
export function durationMinutes(openedAt: string, closedAt?: string): number | undefined {
  if (!closedAt) return undefined;
  const a = Date.parse(openedAt);
  const b = Date.parse(closedAt);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return undefined;
  return (b - a) / 60000;
}

/** Build monthly buckets from a trade list. */
export function buildMonthly(trades: NormalizedTrade[]): MonthlyReturns {
  const map = new Map<string, MonthlyBucket>();
  for (const tr of trades) {
    const d = new Date(tr.closedAt ?? tr.openedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { year: d.getUTCFullYear(), month: d.getUTCMonth(), pnlUsd: 0, trades: 0, wins: 0, losses: 0 };
      map.set(key, bucket);
    }
    if (isFiniteNum(tr.pnlUsd)) bucket.pnlUsd += tr.pnlUsd;
    bucket.trades += 1;
    if ((tr.pnlUsd ?? 0) > 0) bucket.wins += 1;
    else if ((tr.pnlUsd ?? 0) < 0) bucket.losses += 1;
  }
  return [...map.values()].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );
}

/** Monthly profit factor for a bucket (gross profit / gross loss). */
export function bucketProfitFactor(bucket: MonthlyBucket): number | undefined {
  // PF cannot be derived from a single net + counts reliably; approximate only
  // when all trades are wins or all losses (degenerate but honest).
  if (bucket.trades === 0) return undefined;
  if (bucket.losses === 0) return bucket.wins > 0 ? Infinity : undefined;
  if (bucket.wins === 0) return 0;
  return undefined; // mixed: needs per-trade gross split — return undefined honestly
}

export function bucketWinRate(bucket: MonthlyBucket): number {
  if (bucket.trades === 0) return 0;
  return bucket.wins / bucket.trades;
}

/** Aggregate direction metrics from trades. */
export function buildDirection(trades: NormalizedTrade[]): DirectionMetrics {
  let buyCount = 0;
  let sellCount = 0;
  let buyPnl = 0;
  let sellPnl = 0;
  let hasBuyPnl = false;
  let hasSellPnl = false;
  for (const t of trades) {
    if (t.side === 'buy') {
      buyCount += 1;
      if (isFiniteNum(t.pnlUsd)) {
        buyPnl += t.pnlUsd;
        hasBuyPnl = true;
      }
    } else {
      sellCount += 1;
      if (isFiniteNum(t.pnlUsd)) {
        sellPnl += t.pnlUsd;
        hasSellPnl = true;
      }
    }
  }
  return {
    buyCount,
    sellCount,
    buyPnlUsd: hasBuyPnl ? buyPnl : undefined,
    sellPnlUsd: hasSellPnl ? sellPnl : undefined,
  };
}

/** Duration statistics from trades with open+close timestamps. */
export function buildDuration(trades: NormalizedTrade[]): DurationMetrics {
  const durations: number[] = [];
  for (const t of trades) {
    const d = durationMinutes(t.openedAt, t.closedAt);
    if (isFiniteNum(d)) durations.push(d);
  }
  if (!durations.length) return {};
  durations.sort((a, b) => a - b);
  return {
    avgDurationMinutes: sum(durations) / durations.length,
    shortestMinutes: durations[0],
    longestMinutes: durations[durations.length - 1],
  };
}

/** Concentration: top-N by absolute P&L contribution (per symbol here). */
export function buildConcentration(
  trades: NormalizedTrade[],
  by: 'symbol' | 'day' = 'symbol',
): ConcentrationMetrics {
  const map = new Map<string, { pnlUsd: number; trades: number }>();
  for (const t of trades) {
    if (!isFiniteNum(t.pnlUsd)) continue;
    const key =
      by === 'symbol'
        ? t.symbol
        : (t.closedAt ?? t.openedAt).slice(0, 10);
    const cur = map.get(key) ?? { pnlUsd:0, trades: 0 };
    cur.pnlUsd += t.pnlUsd;
    cur.trades += 1;
    map.set(key, cur);
  }
  const sorted = [...map.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => Math.abs(b.pnlUsd) - Math.abs(a.pnlUsd));
  const pnls = trades.map((t) => t.pnlUsd).filter(isFiniteNum);
  return {
    top5: sorted.slice(0, 5),
    top10: sorted.slice(0, 10),
    bestTradeUsd: pnls.length ? Math.max(...pnls) : undefined,
    worstTradeUsd: pnls.length ? Math.min(...pnls) : undefined,
  };
}

/** Win/loss streaks from trades ordered chronologically. */
export function buildStreaks(trades: NormalizedTrade[]): StreakMetrics {
  const ordered = [...trades].sort(
    (a, b) => Date.parse(a.closedAt ?? a.openedAt) - Date.parse(b.closedAt ?? b.openedAt),
  );
  let maxWin = 0;
  let maxLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const t of ordered) {
    const pnl = t.pnlUsd ?? 0;
    if (pnl > 0) {
      curWin += 1;
      curLoss = 0;
      maxWin = Math.max(maxWin, curWin);
    } else if (pnl < 0) {
      curLoss += 1;
      curWin = 0;
      maxLoss = Math.max(maxLoss, curLoss);
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }
  const last = ordered[ordered.length - 1];
  let current = 0;
  if (last) {
    const pnl = last.pnlUsd ?? 0;
    current = pnl > 0 ? curWin : pnl < 0 ? -curLoss : 0;
  }
  return { maxWinStreak: maxWin, maxLossStreak: maxLoss, currentStreak: current };
}

/**
 * Compute an equity curve's high-water mark, final value and worst drawdown.
 * Returns undefined when the series is empty (honest neutral state).
 */
export function equitySummary(series: EquitySeries): {
  high?: number;
  final?: number;
  worstDdUsd?: number;
  worstDdPct?: number;
} {
  if (!series.length) return {};
  let high = series[0]!.equity;
  let peak = high;
  let worstDdUsd = 0;
  let worstDdPct = 0;
  for (const p of series) {
    if (p.equity > peak) peak = p.equity;
    if (p.equity > high) high = p.equity;
    const ddUsd = peak - p.equity;
    const ddPct = peak > 0 ? ddUsd / peak : 0;
    if (ddUsd > worstDdUsd) {
      worstDdUsd = ddUsd;
      worstDdPct = ddPct;
    }
  }
  return {
    high,
    final: series[series.length - 1]!.equity,
    worstDdUsd,
    worstDdPct,
  };
}

/** Filter an equity series to a named time range. */
export type EquityRange = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

export function filterByRange(series: EquitySeries, range: EquityRange): EquitySeries {
  if (range === 'ALL' || !series.length) return series;
  const last = Date.parse(series[series.length - 1]!.timestamp);
  if (Number.isNaN(last)) return series;
  let from: number;
  switch (range) {
    case '1M':
      from = last - 30 * 86400000;
      break;
    case '3M':
      from = last - 90 * 86400000;
      break;
    case '6M':
      from = last - 182 * 86400000;
      break;
    case '1Y':
      from = last - 365 * 86400000;
      break;
    case 'YTD': {
      const d = new Date(last);
      from = Date.UTC(d.getUTCFullYear(), 0, 1);
      break;
    }
  }
  return series.filter((p) => {
    const t = Date.parse(p.timestamp);
    return !Number.isNaN(t) && t >= from;
  });
}

/** Filter trades by a free-text search across id/symbol/side. */
export function filterTrades(
  trades: NormalizedTrade[],
  query: string,
  side?: 'all' | TradeSide,
): NormalizedTrade[] {
  const q = query.trim().toLowerCase();
  return trades.filter((t) => {
    if (side && side !== 'all' && t.side !== side) return false;
    if (!q) return true;
    return (
      t.id.toLowerCase().includes(q) ||
      t.symbol.toLowerCase().includes(q) ||
      t.side.includes(q) ||
      (t.structural ?? '').includes(q)
    );
  });
}

export type TradeSortKey = 'date' | 'pnl' | 'symbol' | 'side';
export type SortDir = 'asc' | 'desc';

export function sortTrades(
  trades: NormalizedTrade[],
  key: TradeSortKey,
  dir: SortDir,
): NormalizedTrade[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...trades].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'date':
        cmp = Date.parse(a.closedAt ?? a.openedAt) - Date.parse(b.closedAt ?? b.openedAt);
        break;
      case 'pnl':
        cmp = (a.pnlUsd ?? 0) - (b.pnlUsd ?? 0);
        break;
      case 'symbol':
        cmp = a.symbol.localeCompare(b.symbol);
        break;
      case 'side':
        cmp = a.side.localeCompare(b.side);
        break;
    }
    return cmp * factor;
  });
}

/** Paginate a trade list (1-based page index). */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, (page - 1) * pageSize);
  return items.slice(start, start + pageSize);
}

/**
 * Build a complete StrategyAnalytics bundle from raw series + owner aggregates.
 * When series are absent (owner has not delivered them yet), only the
 * owner-supplied aggregates and an honest `pending` evidence status are set;
 * every computed field stays undefined so the UI shows a neutral state.
 */
export function buildAnalytics(args: {
  strategyId: string;
  sourceLabel?: string;
  sourceFile?: string;
  receivedAt?: string;
  trades?: NormalizedTrade[];
  equity?: EquitySeries;
  economic?: EconomicMetrics;
  structural?: StructuralMetrics;
}): StrategyAnalytics {
  const hasSeries = !!args.equity?.length || !!args.trades?.length;
  const evidence: EvidenceMetadata = {
    status: hasSeries ? 'real' : 'pending',
    sourceLabel: args.sourceLabel ?? HISTORICAL_BACKTEST_LABEL,
    sourceFile: args.sourceFile,
    receivedAt: args.receivedAt,
    hasSeries,
    notes: hasSeries
      ? undefined
      : 'Per-trade and equity series have not been delivered yet. Aggregate metrics are shown verbatim; curves and logs are pending.',
  };
  const trades = args.trades ?? [];
  return {
    strategyId: args.strategyId,
    evidence,
    equity: args.equity,
    drawdown: args.equity,
    trades: args.trades,
    monthly: trades.length ? buildMonthly(trades) : undefined,
    structural: args.structural,
    economic: args.economic,
    duration: trades.length ? buildDuration(trades) : undefined,
    direction: trades.length ? buildDirection(trades) : undefined,
    concentration: trades.length ? buildConcentration(trades, 'day') : undefined,
    streaks: trades.length ? buildStreaks(trades) : undefined,
  };
}
