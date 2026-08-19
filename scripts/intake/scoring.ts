/**
 * QNT-0003 reusable Quantora Score.
 *
 * A common, data-driven 0-100 score for every strategy. It is computed only
 * from available data and is never tuned to favour a specific strategy.
 *
 * Formula (weights documented below, summing to 1.00):
 *
 *   component                 weight
 *   Profit Factor             0.25
 *   Drawdown vs result        0.25
 *   Equity stability          0.15
 *   Trade count               0.10
 *   Temporal consistency      0.10
 *   Frequency                 0.05
 *   Costs                     0.05
 *   Evidence completeness     0.05
 *
 * Each component normalizes its input to 0..100. The final score is a weighted
 * average over the *available* components. When a component's data is missing
 * it is treated neutrally (excluded) and the reported `confidence` drops
 * accordingly — a missing value is never invented.
 *
 * Profit Factor tiering (a general rule, not a strategy-specific one): the
 * minimum publishable PF is 1.15 (enforced by the publication filter). A PF of
 * 1.20 or higher is the *favorable* tier and earns a documented +5 bonus on the
 * Profit Factor component (capped at 100).
 */
import type { QuantoraScore, QuantoraScoreComponent } from '../../src/domain/publicStrategy.ts';

export const FAVORABLE_PROFIT_FACTOR = 1.2;
export const FAVORABLE_PF_BONUS = 5;
export const SCORE_VERSION = 'beta-1';

export type ScoreInput = {
  profitFactor?: number;
  netUsd?: number;
  maxDrawdownUsd?: number;
  /** Equity points ordered by time (used for stability + temporal consistency). */
  equity?: { timestamp: string; equity: number }[];
  trades?: number;
  frequencyPerMonth?: number;
  costPerTradeUsd?: number;
  expectancyUsd?: number;
  /** 0..1 fraction of the expected evidence set that is present. */
  evidenceComplete?: number;
  /**
   * True when reported results already include commissions/spread/slippage.
   * When explicitly false, the costs component is unavailable (never credited
   * with points) and the final confidence is reduced. When undefined the legacy
   * behaviour applies (costs computed from the available numbers).
   */
  costsApplied?: boolean;
};

const WEIGHTS = {
  profitFactor: 0.25,
  drawdown: 0.25,
  equityStability: 0.15,
  trades: 0.1,
  temporalConsistency: 0.1,
  frequency: 0.05,
  costs: 0.05,
  evidence: 0.05,
} as const;

export const SCORE_FORMULA =
  '0-100 weighted average: Profit Factor 25% (break-even 1.0 = 50, 2.0+ = 100; PF >= 1.20 favorable tier +5, capped), Drawdown-vs-result 25%, Equity stability 15%, Trade count 10%, Temporal consistency 10%, Frequency 5%, Costs 5%, Evidence completeness 5%. Missing components are excluded and reduce confidence.';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** R² of a linear fit over the series (0..1). Higher = steadier growth. */
function rSquared(values: number[]): number | null {
  if (values.length < 3) return null;
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += values[i]!;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = i - meanX;
    const dy = values[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return null;
  const r = num / Math.sqrt(denX * denY);
  return r * r;
}

/** Distinct calendar months covered by the equity curve, as "YYYY-MM" keys. */
function monthKeys(timestamps: string[]): { keys: Set<string>; span: number } {
  const keys = new Set<string>();
  for (const ts of timestamps) {
    const month = ts.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) keys.add(month);
  }
  let span = 0;
  if (keys.size > 0) {
    const sorted = [...keys].sort();
    const [fy, fm] = sorted[0]!.split('-').map(Number) as [number, number];
    const [ly, lm] = sorted[sorted.length - 1]!.split('-').map(Number) as [number, number];
    span = (ly - fy) * 12 + (lm - fm) + 1;
  }
  return { keys, span };
}

function component(
  key: string,
  label: string,
  weight: number,
  points: number | null,
  note?: string,
): QuantoraScoreComponent {
  return {
    key,
    label,
    weight,
    points: points === null ? 0 : Math.round(clamp(points, 0, 100)),
    available: points !== null,
    note,
  };
}

export function computeQuantoraScore(input: ScoreInput): QuantoraScore {
  const equity = input.equity ?? [];

  // Profit Factor: 1.0 (break-even) = 50, rising to 100 at PF ≥ 2.0. A PF of
  // 1.20 or higher is the favorable tier and earns a documented +5 bonus.
  const pfBase =
    finite(input.profitFactor) && input.profitFactor! > 0
      ? (0.5 + (input.profitFactor! - 1.0) * 0.5) * 100
      : null;
  const pfFavorable = finite(input.profitFactor) && input.profitFactor! >= FAVORABLE_PROFIT_FACTOR;
  const pfPoints = pfBase === null ? null : clamp(pfBase + (pfFavorable ? FAVORABLE_PF_BONUS : 0), 0, 100);
  const pfNote = pfFavorable ? `PF >= ${FAVORABLE_PROFIT_FACTOR.toFixed(2)} (favorable tier)` : undefined;

  // Drawdown relative to result: drawdown / net. 0 → 100, ratio 1.5 → 0.
  const ddPoints =
    finite(input.netUsd) && finite(input.maxDrawdownUsd) && input.netUsd! > 0 && input.maxDrawdownUsd! >= 0
      ? (1 - input.maxDrawdownUsd! / input.netUsd! / 1.5) * 100
      : null;

  const rsq = rSquared(equity.map((p) => p.equity));
  const stabilityPoints = rsq === null ? null : rsq * 100;

  const tradesPoints = finite(input.trades) && input.trades! > 0 ? (input.trades! / 100) * 100 : null;

  const months = monthKeys(equity.map((p) => p.timestamp));
  const temporalPoints =
    months.span > 1 ? (months.keys.size / months.span) * 100 : null;

  // Frequency: 12 trades/month is treated as full cadence.
  const frequencyPoints =
    finite(input.frequencyPerMonth) && input.frequencyPerMonth! > 0
      ? (input.frequencyPerMonth! / 12) * 100
      : null;

  // Costs: cost per trade relative to expectancy. 0 cost ratio → 100, ratio 0.5 → 0.
  // When costsApplied === false the reported numbers exclude costs, so the
  // component is NOT credited and stays unavailable (a zero cost figure in the
  // export must never be read as confirmed real costs).
  const costPoints =
    input.costsApplied === false
      ? null
      : finite(input.costPerTradeUsd) &&
          finite(input.expectancyUsd) &&
          input.expectancyUsd! > 0 &&
          input.costPerTradeUsd! >= 0
        ? (1 - input.costPerTradeUsd! / input.expectancyUsd! / 0.5) * 100
        : null;

  const evidencePoints =
    finite(input.evidenceComplete) && input.evidenceComplete! >= 0 && input.evidenceComplete! <= 1
      ? input.evidenceComplete! * 100
      : null;

  const components: QuantoraScoreComponent[] = [
    component('profitFactor', 'Profit Factor', WEIGHTS.profitFactor, pfPoints, pfNote),
    component('drawdown', 'Drawdown vs result', WEIGHTS.drawdown, ddPoints),
    component('equityStability', 'Equity stability', WEIGHTS.equityStability, stabilityPoints),
    component('trades', 'Trade count', WEIGHTS.trades, tradesPoints),
    component('temporalConsistency', 'Temporal consistency', WEIGHTS.temporalConsistency, temporalPoints),
    component('frequency', 'Frequency', WEIGHTS.frequency, frequencyPoints),
    component('costs', 'Costs', WEIGHTS.costs, costPoints),
    component('evidence', 'Evidence completeness', WEIGHTS.evidence, evidencePoints),
  ];

  const available = components.filter((c) => c.available);
  const weightSum = available.reduce((sum, c) => sum + c.weight, 0);
  const value = weightSum > 0
    ? Math.round(available.reduce((sum, c) => sum + c.weight * c.points, 0) / weightSum)
    : 0;

  return {
    value: Math.round(clamp(value, 0, 100)),
    confidence: Math.round(clamp(weightSum, 0, 1) * 1000) / 1000,
    components,
    formula: SCORE_FORMULA,
    version: SCORE_VERSION,
  };
}
