import { describe, expect, test } from 'bun:test';
import { REAL_BACKTESTS } from '../../generated/real-backtests';
import { firstTriangleBranch5, stochExtremeAmpSea2575 } from '../backtest-adapters';
import { equitySummary, filterByRange, filterTrades, paginate, sortTrades } from '../analytics';

describe('audited real backtest derivatives', () => {
  test('keeps Stoch run, ordered unique trades, reconciled PnL/R and source-driven structural classification', () => {
    const data = REAL_BACKTESTS.stochExtreme;
    expect(data.runId).toBe('SEA2575_AMP_@ENQ_1754006400');
    expect(new Set(data.trades.map((t) => t.id)).size).toBe(421);
    expect(data.trades.every((t, i) => i === 0 || t.openedAt >= data.trades[i - 1]!.openedAt)).toBe(true);
    expect(data.trades.reduce((sum, t) => sum + t.pnlUsd, 0)).toBeCloseTo(6582, 6);
    expect(data.trades.reduce((sum, t) => sum + t.rMultiple, 0)).toBeCloseTo(32.91, 6);
    expect(data.trades.every((t) => t.structural === 'loss' ? t.exitReason === 'SL' : (t.side === 'buy' ? t.exitReason === 'TARGET_K80_M30_CLOSE' : t.exitReason === 'TARGET_K20_M30_CLOSE'))).toBe(true);
  });
  test('keeps First Triangle branch 5 only and distinguishes official versus closed-trade DD', () => {
    const data = REAL_BACKTESTS.firstTriangleBranch5;
    expect(data.branchId).toBe(5); expect(data.trades).toHaveLength(145);
    expect(data.trades.reduce((sum, t) => sum + t.pnlUsd, 0)).toBeCloseTo(6687.5, 6);
    expect(data.controls.officialDrawdownUsd).toBe(4474.8);
    expect(data.controls.closedTradeDrawdownUsd).toBe(4151.5);
    expect(data.controls.openAtEnd).toBe(false);
  });
  test('adapters expose real equity/DD, monthly aggregation, ranges and reproducible reduction controls', () => {
    const stoch = stochExtremeAmpSea2575(); const triangle = firstTriangleBranch5();
    expect(stoch.evidence.status).toBe('real'); expect(stoch.trades).toHaveLength(421); expect(stoch.monthly).toHaveLength(13);
    expect(equitySummary(stoch.equity!).worstDdUsd).toBeCloseTo(4690, 6);
    expect(REAL_BACKTESTS.stochExtreme.equityReduction).toMatchObject({ originalPoints: 361248, finalPoints: 1197 });
    expect(triangle.monthly).toHaveLength(13); expect(triangle.equity).toHaveLength(145);
    expect(filterByRange(stoch.equity!, '1M').length).toBeGreaterThan(0);
  });
  test('trade filters, ordering and pagination operate on audited trade logs', () => {
    const trades = stochExtremeAmpSea2575().trades!;
    const buys = filterTrades(trades, '@enq', 'buy');
    expect(buys.length).toBe(176);
    const highest = sortTrades(trades, 'pnl', 'desc');
    expect(highest[0]!.pnlUsd).toBe(1546);
    expect(paginate(highest, 2, 12)).toHaveLength(12);
  });
});
