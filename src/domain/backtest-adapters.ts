/** V2B adapters for audited browser derivatives. Archives/CSVs never load at runtime. */
import { REAL_BACKTESTS } from '../generated/real-backtests';
import { buildAnalytics, HISTORICAL_BACKTEST_LABEL, type EconomicMetrics, type EquityPoint, type NormalizedTrade, type StrategyAnalytics } from './analytics';

type RealBundle = typeof REAL_BACKTESTS.stochExtreme | typeof REAL_BACKTESTS.firstTriangleBranch5;
function asTrades(bundle: RealBundle): NormalizedTrade[] {
  return bundle.trades.map((trade) => ({ ...trade }));
}
function asEquity(bundle: RealBundle): EquityPoint[] {
  return bundle.equity.map(({ timestamp, equity, balance, drawdownUsd }) => ({ timestamp, equity, balance, drawdownUsd }));
}
export function stochExtremeAmpSea2575(): StrategyAnalytics {
  const source = REAL_BACKTESTS.stochExtreme;
  const economic: EconomicMetrics = {
    netProfitUsd: source.controls.netUsd,
    profitFactor: source.controls.profitFactor,
    avgPerTradeUsd: source.controls.netUsd / source.controls.trades,
  };
  return buildAnalytics({
    strategyId: 'stochextreme-adaptive',
    sourceLabel: HISTORICAL_BACKTEST_LABEL,
    sourceFile: 'Owner Supplied immutable archive evidence',
    trades: asTrades(source),
    equity: asEquity(source),
    economic,
    structural: {
      winCount: source.controls.structuralWins,
      lossCount: source.controls.structuralLosses,
      total: source.controls.trades,
      winRate: source.controls.structuralWins / source.controls.trades,
      winRule: 'Structural BUY WIN only on the upper extreme (K80 close); structural SELL WIN only on the lower extreme (K20 close). This is read from structural_outcome, never inferred from P&L.',
      lossRule: 'Structural LOSS only on the final configured 100-point stop (SL). Price slippage is not reclassified from P&L.',
    },
  });
}
export function firstTriangleBranch5(): StrategyAnalytics {
  const source = REAL_BACKTESTS.firstTriangleBranch5;
  return buildAnalytics({
    strategyId: 'first-triangle-adaptive',
    sourceLabel: HISTORICAL_BACKTEST_LABEL,
    sourceFile: 'Owner Supplied immutable archive evidence; selected branch 5 only',
    trades: asTrades(source),
    equity: asEquity(source),
    economic: {
      netProfitUsd: source.controls.netUsd,
      profitFactor: source.controls.profitFactor,
      avgPerTradeUsd: source.controls.expectancyUsd,
      grossProfitUsd: undefined,
      grossLossUsd: undefined,
    },
  });
}
