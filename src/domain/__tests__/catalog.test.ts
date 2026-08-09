import { test, expect } from 'bun:test';
import { assertScoreConsistency, findProfile, POWER_SCORE_EXPLANATION } from '../product';
import { runMatcher } from '../matcher';
import { addToCompare, COMPARE_MAX } from '../compare';
import { emptyDraft, validateStep } from '../publish';

test('owner metrics are exactly as provided (First Triangle Adaptive)', () => {
  const p = findProfile('first-triangle-adaptive')!;
  expect(p.metrics.powerScore).toBe(7.2);
  expect(p.metrics.profitFactor).toBe(1.2559);
  expect(p.metrics.tradeCount).toBe(145);
  expect(p.metrics.netProfitUsd).toBe(6687.5);
  expect(p.metrics.avgProfitPerTradeUsd).toBe(46.12);
  expect(p.metrics.maxDrawdownUsd).toBe(4474.8);
});

test('owner metrics are exactly as provided (StochExtreme Adaptive)', () => {
  const p = findProfile('stochextreme-adaptive')!;
  expect(p.metrics.powerScore).toBe(6.1);
  expect(p.metrics.profitFactor).toBe(1.1514);
  expect(p.metrics.tradeCount).toBe(421);
  expect(p.metrics.netProfitUsd).toBe(6582);
  expect(p.metrics.maxDrawdownPct).toBe(26.53);
  expect(p.metrics.maxDrawdownUsd).toBe(4690);
  expect(p.metrics.ticksProcessed).toBe(509489041);
  expect(p.metrics.periodStart).toBe('2025-08-01');
  expect(p.metrics.periodEnd).toBe('2026-08-07');
});

test('every power score equals its weighted dimension sum', () => {
  expect(assertScoreConsistency()).toEqual([]);
});

test('the Power Score explanation is present and non-promissory', () => {
  expect(POWER_SCORE_EXPLANATION).toContain('NOT a prediction');
  expect(POWER_SCORE_EXPLANATION).toContain('or investment advice');
});

test('compare basket caps at 3', () => {
  let list: string[] = [];
  for (const id of ['a', 'b', 'c', 'd']) list = addToCompare(list, id);
  expect(list.length).toBe(COMPARE_MAX);
  expect(addToCompare(['a'], 'a')).toEqual(['a']);
});

test('matcher returns explained matches', () => {
  const results = runMatcher({ risk: 'low' });
  expect(results.length).toBeGreaterThan(0);
  expect(results[0]!.reasons.length).toBeGreaterThan(0);
  expect(results.every((r) => r.matched === r.reasons.length)).toBe(true);
});

test('publish wizard validation is friendly', () => {
  const d = emptyDraft();
  const errors = validateStep(d, 0);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]!.message.length).toBeGreaterThan(10);
});
