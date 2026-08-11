/** V2B gateway: audited adapters take priority; legacy mock profiles retain mock-only fixtures. */
import type { StrategyProfile } from './product';
import { buildAnalytics, HISTORICAL_BACKTEST_LABEL, OWNER_SUPPLIED_LABEL, type StrategyAnalytics, type EquitySeries, type EconomicMetrics, type StructuralMetrics } from './analytics';
import { firstTriangleBranch5, stochExtremeAmpSea2575 } from './backtest-adapters';
function mockCurveToSeries(curve: number[], baseDate: string): EquitySeries {
  const start = Date.parse(baseDate); const step = 365 * 86400000 / Math.max(1, curve.length - 1);
  return curve.map((v, i) => ({ timestamp: new Date(start + i * step).toISOString(), equity: v }));
}
export function analyticsForProfile(profile: StrategyProfile): StrategyAnalytics {
  if (profile.id === 'stocherextreme-adaptive') return stochExtremeAmpSea2575();
  if (profile.id === 'first-triangle-adaptive') return firstTriangleBranch5();
  const economic: EconomicMetrics = { netProfitUsd: profile.metrics.netProfitUsd, profitFactor: profile.metrics.profitFactor, avgPerTradeUsd: profile.metrics.avgProfitPerTradeUsd ?? (profile.metrics.netProfitUsd !== undefined && profile.metrics.tradeCount ? profile.metrics.netProfitUsd / profile.metrics.tradeCount : undefined) };
  const structural: StructuralMetrics | undefined = profile.structuralFacts ? { ...profile.structuralFacts, total: profile.structuralFacts.winCount + profile.structuralFacts.lossCount, winRate: profile.structuralFacts.winCount / (profile.structuralFacts.winCount + profile.structuralFacts.lossCount) } : undefined;
  if (profile.dataStatus === 'real') return buildAnalytics({ strategyId: profile.id, sourceLabel: HISTORICAL_BACKTEST_LABEL, sourceFile: profile.evidenceSource === OWNER_SUPPLIED_LABEL ? 'Owner Supplied' : undefined, economic, structural });
  return buildAnalytics({ strategyId: profile.id, sourceLabel: 'Mock demo', economic, structural, equity: profile.curve ? mockCurveToSeries(profile.curve, `${profile.updatedAt}T00:00:00Z`) : undefined });
}
