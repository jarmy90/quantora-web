/**
 * QNT-0003 reusable publication filter.
 *
 * Decides whether a strategy's *results* are sufficient to appear in the public
 * catalog. It is a shared rule for every strategy — never a strategy-specific
 * condition.
 *
 * The only performance threshold is the minimum Profit Factor of 1.20. Drawdown
 * is deliberately **not** a blocking rule yet (no universal drawdown limit has
 * been fixed); instead it is surfaced on the card/detail and reduces the
 * Quantora Score.
 */
import type { PublicStrategy } from '../../src/domain/publicStrategy.ts';

export const MIN_PROFIT_FACTOR = 1.2;

export type PublishDecision = {
  publish: boolean;
  reasons: string[];
};

export type PublishFilterInput = {
  name?: string;
  dataStatus?: string;
  profitFactor?: number;
  trades?: number;
  equityPointCount?: number;
};

export function evaluatePublishFilter(input: PublishFilterInput): PublishDecision {
  const reasons: string[] = [];

  if (!input.name || !input.name.trim()) {
    reasons.push('Strategy identity (name) is missing.');
  }

  // Mock strategies are demo fixtures and are not filtered by performance.
  if (input.dataStatus === 'mock') {
    return { publish: reasons.length === 0, reasons };
  }

  if (typeof input.profitFactor !== 'number' || !Number.isFinite(input.profitFactor)) {
    reasons.push('Profit Factor is missing.');
  } else if (input.profitFactor <= MIN_PROFIT_FACTOR) {
    reasons.push(
      `Profit Factor ${input.profitFactor.toFixed(4)} does not exceed the ${MIN_PROFIT_FACTOR.toFixed(2)} minimum.`,
    );
  }

  if (typeof input.trades !== 'number' || !Number.isFinite(input.trades) || input.trades < 1) {
    reasons.push('No closed trades are available.');
  }

  if (typeof input.equityPointCount !== 'number' || input.equityPointCount < 2) {
    reasons.push('The equity curve has fewer than 2 points.');
  }

  return { publish: reasons.length === 0, reasons };
}

/** Convenience wrapper over the public shape used by the catalog builder. */
export function shouldPublish(strategy: PublicStrategy): PublishDecision {
  return evaluatePublishFilter({
    name: strategy.name,
    dataStatus: undefined, // public shape carries no internal status; results are required
    profitFactor: strategy.metrics?.profitFactor,
    trades: strategy.metrics?.trades,
    equityPointCount: strategy.equity?.points.length,
  });
}
