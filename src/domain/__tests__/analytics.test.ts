import { test, expect } from 'bun:test';
import {
  buildMonthly,
  buildDirection,
  buildDuration,
  buildConcentration,
  buildStreaks,
  equitySummary,
  filterByRange,
  filterTrades,
  sortTrades,
  paginate,
  bucketWinRate,
  sum,
  mean,
  durationMinutes,
  type NormalizedTrade,
  type EquitySeries,
} from '../analytics';
import {
  parseTradesCsv,
  parseEquityCsv,
  parseManifestCsv,
  detectEntity,
  withinPreviewLimits,
  splitCsv,
} from '../csv-import';
import { analyticsForProfile } from '../strategy-analytics';
import { findProfile } from '../product';

const sampleTrades = (): NormalizedTrade[] => [
  { id: 't1', side: 'buy', openedAt: '2025-08-01T09:00:00Z', closedAt: '2025-08-01T10:00:00Z', symbol: 'USTEC', quantity: 1, entryPrice: 18000, exitPrice: 18120, pnlUsd: 120, structural: 'win' },
  { id: 't2', side: 'sell', openedAt: '2025-08-02T09:00:00Z', closedAt: '2025-08-02T09:30:00Z', symbol: 'USTEC', quantity: 1, entryPrice: 18120, exitPrice: 18220, pnlUsd: -100, structural: 'loss' },
  { id: 't3', side: 'buy', openedAt: '2025-09-01T09:00:00Z', closedAt: '2025-09-01T11:00:00Z', symbol: 'USTEC', quantity: 2, entryPrice: 18000, exitPrice: 18250, pnlUsd: 500, structural: 'win' },
  { id: 't4', side: 'sell', openedAt: '2025-09-03T09:00:00Z', closedAt: '2025-09-03T09:15:00Z', symbol: 'USTEC', quantity: 1, entryPrice: 18250, exitPrice: 18300, pnlUsd: -50, structural: 'loss' },
];

test('sum and mean handle empty / mixed inputs', () => {
  expect(sum([])).toBe(0);
  expect(sum([1, 2, NaN, 3])).toBe(6);
  expect(mean([])).toBeUndefined();
  expect(mean([2, 4])).toBe(3);
});

test('durationMinutes returns undefined when closedAt missing or invalid', () => {
  expect(durationMinutes('2025-08-01T09:00:00Z')).toBeUndefined();
  expect(durationMinutes('2025-08-01T09:00:00Z', 'not-a-date')).toBeUndefined();
  expect(durationMinutes('2025-08-01T09:00:00Z', '2025-08-01T10:00:00Z')).toBe(60);
});

test('buildMonthly aggregates per year/month', () => {
  const m = buildMonthly(sampleTrades());
  expect(m.length).toBe(2); // Aug 2025 + Sep 2025
  const aug = m.find((b) => b.month === 7)!;
  expect(aug.trades).toBe(2);
  expect(aug.pnlUsd).toBe(20);
  expect(aug.wins).toBe(1);
  expect(aug.losses).toBe(1);
});

test('bucketWinRate is 0 when no trades and a ratio otherwise', () => {
  expect(bucketWinRate({ year: 2025, month: 0, pnlUsd: 0, trades: 0, wins: 0, losses: 0 })).toBe(0);
  expect(bucketWinRate({ year: 2025, month: 0, pnlUsd: 0, trades: 4, wins: 3, losses: 1 })).toBeCloseTo(0.75);
});

test('buildDirection counts sides and sums P&L', () => {
  const d = buildDirection(sampleTrades());
  expect(d.buyCount).toBe(2);
  expect(d.sellCount).toBe(2);
  expect(d.buyPnlUsd).toBe(620);
  expect(d.sellPnlUsd).toBe(-150);
});

test('buildDuration computes shortest/longest/avg in minutes', () => {
  const d = buildDuration(sampleTrades());
  expect(d.shortestMinutes).toBe(15);
  expect(d.longestMinutes).toBe(120);
  expect(d.avgDurationMinutes).toBeCloseTo((60 + 30 + 120 + 15) / 4);
});

test('buildConcentration ranks by absolute P&L and finds best/worst', () => {
  const c = buildConcentration(sampleTrades());
  expect(c.top5.length).toBe(1); // single symbol USTEC
  expect(c.bestTradeUsd).toBe(500);
  expect(c.worstTradeUsd).toBe(-100);
});

test('buildStreaks finds max win/loss streaks', () => {
  const s = buildStreaks(sampleTrades());
  expect(s.maxWinStreak).toBe(1);
  expect(s.maxLossStreak).toBe(1);
});

test('equitySummary returns empty object for empty series', () => {
  expect(equitySummary([])).toEqual({});
  const s = equitySummary([
    { timestamp: '2025-01-01T00:00:00Z', equity: 1000 },
    { timestamp: '2025-01-02T00:00:00Z', equity: 1200 },
    { timestamp: '2025-01-03T00:00:00Z', equity: 900 },
  ]);
  expect(s.high).toBe(1200);
  expect(s.final).toBe(900);
  expect(s.worstDdUsd).toBe(300);
  expect(s.worstDdPct).toBeCloseTo(0.25);
});

test('filterByRange returns full series for ALL and subsets otherwise', () => {
  const series: EquitySeries = Array.from({ length: 100 }, (_, i) => ({
    timestamp: new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString(),
    equity: 1000 + i,
  }));
  expect(filterByRange(series, 'ALL').length).toBe(100);
  expect(filterByRange(series, '1M').length).toBeLessThanOrEqual(31);
  expect(filterByRange(series, '1M').length).toBeGreaterThan(0);
});

test('filterTrades searches text and side', () => {
  const trades = sampleTrades();
  expect(filterTrades(trades, 't1').length).toBe(1);
  expect(filterTrades(trades, '', 'buy').length).toBe(2);
  expect(filterTrades(trades, 'win').length).toBe(2);
});

test('sortTrades sorts by pnl desc and asc', () => {
  const trades = sampleTrades();
  const desc = sortTrades(trades, 'pnl', 'desc');
  expect(desc[0]!.pnlUsd).toBe(500);
  const asc = sortTrades(trades, 'pnl', 'asc');
  expect(asc[0]!.pnlUsd).toBe(-100);
});

test('paginate returns the expected slice', () => {
  const items = [1, 2, 3, 4, 5, 6, 7];
  expect(paginate(items, 1, 3)).toEqual([1, 2, 3]);
  expect(paginate(items, 3, 3)).toEqual([7]);
  expect(paginate(items, 10, 3)).toEqual([]);
});

test('analyticsForProfile returns pending evidence for real strategies', () => {
  const a = analyticsForProfile(findProfile('stochextreme-adaptive')!);
  expect(a.evidence.status).toBe('pending');
  expect(a.evidence.hasSeries).toBe(false);
  expect(a.equity).toBeUndefined();
  expect(a.trades).toBeUndefined();
  expect(a.economic?.profitFactor).toBe(1.1514);
  expect(a.structural?.winCount).toBe(200);
  expect(a.structural?.lossCount).toBe(221);
});

test('analyticsForProfile builds a mock series for legacy fixtures', () => {
  const a = analyticsForProfile(findProfile('atlas-btc')!);
  expect(a.evidence.hasSeries).toBe(true);
  expect(a.equity?.length).toBeGreaterThan(0);
  expect(a.evidence.status).toBe('real'); // series present -> real evidence flag
});

test('splitCsv throws on empty input', () => {
  expect(() => splitCsv('')).toThrow('empty');
  expect(() => splitCsv('a,b\n1,2,3')).not.toThrow(); // uneven row handled by caller
});

test('parseTradesCsv validates required columns and parses valid rows', () => {
  const csv = 'id,side,openedAt,symbol,quantity,entryPrice,pnlUsd,structural\nt1,buy,2025-08-01T09:00:00Z,USTEC,1,18000,120,win\nt2,sell,2025-08-02T09:00:00Z,USTEC,1,18100,-50,loss';
  const res = parseTradesCsv(csv);
  expect(res.errors.length).toBe(0);
  expect(res.rows.length).toBe(2);
  expect(res.rows[0]!.side).toBe('buy');
  expect(res.rows[1]!.structural).toBe('loss');
});

test('parseTradesCsv reports missing required column', () => {
  const csv = 'id,side,openedAt,quantity,entryPrice\nt1,buy,2025-08-01T09:00:00Z,1,18000';
  const res = parseTradesCsv(csv);
  expect(res.errors.some((e) => e.column === 'symbol')).toBe(true);
  expect(res.rows.length).toBe(0);
});

test('parseTradesCsv reports invalid numeric and side values', () => {
  const csv = 'id,side,openedAt,symbol,quantity,entryPrice\nt1,hold,2025-08-01T09:00:00Z,USTEC,abc,18000';
  const res = parseTradesCsv(csv);
  expect(res.errors.some((e) => e.column === 'side')).toBe(true);
  expect(res.errors.some((e) => e.column === 'quantity')).toBe(true);
  expect(res.rows.length).toBe(0);
});

test('parseTradesCsv reports invalid date', () => {
  const csv = 'id,side,openedAt,symbol,quantity,entryPrice\nt1,buy,not-a-date,USTEC,1,18000';
  const res = parseTradesCsv(csv);
  expect(res.errors.some((e) => e.column === 'openedAt')).toBe(true);
});

test('parseEquityCsv parses a valid equity series', () => {
  const csv = 'timestamp,equity,drawdownUsd\n2025-08-01T00:00:00Z,1000,0\n2025-08-02T00:00:00Z,1100,0';
  const res = parseEquityCsv(csv);
  expect(res.errors.length).toBe(0);
  expect(res.rows.length).toBe(2);
  expect(res.rows[0]!.equity).toBe(1000);
});

test('parseEquityCsv rejects invalid equity value', () => {
  const csv = 'timestamp,equity\n2025-08-01T00:00:00Z,notnum';
  const res = parseEquityCsv(csv);
  expect(res.errors.some((e) => e.column === 'equity')).toBe(true);
  expect(res.rows.length).toBe(0);
});

test('parseManifestCsv parses descriptive rows', () => {
  const csv = 'field,value\nversion,v1.07 filtered\nsymbol,USTEC';
  const res = parseManifestCsv(csv);
  expect(res.errors.length).toBe(0);
  expect(res.rows.length).toBe(2);
  expect(res.rows[0]!.value).toBe('v1.07 filtered');
});

test('detectEntity infers entity from filename', () => {
  expect(detectEntity('trades.csv')).toBe('trades');
  expect(detectEntity('equity.csv')).toBe('equity');
  expect(detectEntity('manifest.csv')).toBe('manifest');
  expect(detectEntity('notes.txt')).toBeNull();
});

test('withinPreviewLimits enforces size and row caps', () => {
  expect(withinPreviewLimits('a,b\n1,2', 2)).toBeNull();
  expect(withinPreviewLimits('x'.repeat(3_000_000), 1)).not.toBeNull();
  expect(withinPreviewLimits('a', 6000)).not.toBeNull();
});

test('parseTradesCsv reports uneven column counts', () => {
  const csv = 'id,side,openedAt,symbol,quantity,entryPrice\nt1,buy,2025-08-01T09:00:00Z,USTEC,1';
  const res = parseTradesCsv(csv);
  expect(res.errors.some((e) => e.message.includes('Expected 6 columns'))).toBe(true);
});
