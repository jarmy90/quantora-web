/**
 * V2B — Connects a StrategyProfile to its StrategyAnalytics bundle.
 *
 * Real (owner-supplied) profiles: aggregate metrics pass through verbatim;
 * per-trade/equity series are pending (not delivered), so the bundle carries
 * an honest `pending` evidence status and no invented series. Structural facts
 * from the profile are surfaced.
 *
 * Legacy mock fixtures: the illustrative `curve` array is converted to a
 * synthetic EquitySeries purely for demonstration of the chart UI, clearly
 * labeled as mock. Real historicals are NEVER given a mock curve.
 */
import type { StrategyProfile } from './product';
import {
  buildAnalytics,
  HISTORICAL_BACKTEST_LABEL,
  OWNER_SUPPLIED_LABEL,
  type StrategyAnalytics,
  type EquitySeries,
  type EconomicMetrics,
  type StructuralMetrics,
} from './analytics';

function mockCurveToSeries(curve: number[], baseDate: string): EquitySeries {
  // Spread the illustrative points across a notional year; this is MOCK ONLY.
  const start = Date.parse(baseDate);
  const step = 365 * 86400000 / Math.max(1, curve.length - 1);
  return curve.map((v, i) => ({
    timestamp: new Date(start + i * step).toISOString(),
    equity: v,
  }));
}

export function analyticsForProfile(profile: StrategyProfile): StrategyAnalytics {
  const isReal = profile.dataStatus === 'real';

  const economic: EconomicMetrics = {
    netProfitUsd: profile.metrics.netProfitUsd,
    profitFactor: profile.metrics.profitFactor,
    avgPerTradeUsd:
      profile.metrics.avgProfitPerTradeUsd ??
      (profile.metrics.netProfitUsd !== undefined && profile.metrics.tradeCount
        ? profile.metrics.netProfitUsd / profile.metrics.tradeCount
        : undefined),
  };

  let structural: StructuralMetrics | undefined;
  if (profile.structuralFacts) {
    const sf = profile.structuralFacts;
    structural = {
      winCount: sf.winCount,
      lossCount: sf.lossCount,
      total: sf.winCount + sf.lossCount,
      winRate: sf.winCount + sf.lossCount > 0 ? sf.winCount / (sf.winCount + sf.lossCount) : 0,
      winRule: sf.winRule,
      lossRule: sf.lossRule,
    };
  }

  if (isReal) {
    // Real historicals: no invented series. Honest pending state.
    return buildAnalytics({
      strategyId: profile.id,
      sourceLabel: HISTORICAL_BACKTEST_LABEL,
      sourceFile: profile.evidenceSource === OWNER_SUPPLIED_LABEL ? 'Owner Supplied' : undefined,
      economic,
      structural,
    });
  }

  // Legacy mock fixture: demonstrate the chart UI with the illustrative curve.
  const equity = profile.curve
    ? mockCurveToSeries(profile.curve, `${profile.updatedAt}T00:00:00Z`)
    : undefined;
  return buildAnalytics({
    strategyId: profile.id,
    sourceLabel: 'Mock demo',
    economic,
    structural,
    equity,
  });
}
