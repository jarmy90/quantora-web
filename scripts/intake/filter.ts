/**
 * QNT-0003 reusable publication filter (QNT-0003H).
 *
 * Decides whether a strategy may appear in the public catalog. It is a shared
 * rule for every strategy — never a strategy-specific condition.
 *
 * Two versioned publication modes:
 *
 * - `documentary`: identity + provenance are enough to publish. No Profit
 *   Factor, trades or equity are required; metrics and equity are never
 *   fabricated, and no score is computed without sufficient results.
 * - `results`: performance evidence is required (finite Profit Factor >= 1.15,
 *   at least one closed trade, an equity curve with at least two points, an
 *   analyzed period, a maximum drawdown, and `costsApplied` explicitly
 *   defined). `costsApplied: false` does NOT block — it is surfaced, reduces
 *   score confidence and marks the costs component unavailable.
 *
 * The Profit Factor >= 1.15 minimum is a **beta provisional threshold**, not an
 * independent validation. A PF of 1.20 or higher is the *favorable* tier and is
 * rewarded by the Quantora Score (see scoring.ts), but it is not mandatory.
 */

export const MIN_PROFIT_FACTOR = 1.15;
export const FILTER_VERSION = 'beta-1';

export type PublicationMode = 'documentary' | 'results';

export type PublishDecision = {
  publish: boolean;
  reasons: string[];
};

export type PublishFilterInput = {
  // Identity / documentary requirements.
  id?: string;
  name?: string;
  version?: string;
  descriptionOrRules?: boolean;
  marketOrAssets?: boolean;
  limitations?: boolean;
  /** Internal: provenance present and valid (dataStatus real/mock). */
  provenanceValid?: boolean;
  /** Internal: validationStatus compatible with publication (not rejected). */
  validationStatusCompatible?: boolean;
  /** Identifiable source or authorized evidence present. */
  evidenceAvailable?: boolean;
  // Results requirements.
  dataStatus?: string;
  publicationMode?: PublicationMode;
  profitFactor?: number;
  trades?: number;
  equityPointCount?: number;
  periodStart?: string;
  periodEnd?: string;
  maxDrawdownUsd?: number;
  /** Explicitly defined (true or false); undefined blocks results mode. */
  costsApplied?: boolean;
};

export function evaluatePublishFilter(input: PublishFilterInput): PublishDecision {
  const reasons: string[] = [];
  const mode = input.publicationMode ?? 'results';

  if (!input.name || !input.name.trim()) {
    reasons.push('Strategy identity (name) is missing.');
  }

  if (mode === 'documentary') {
    if (!input.id || !input.id.trim()) reasons.push('Strategy ID is missing.');
    if (!input.version || !input.version.trim()) reasons.push('Version is missing.');
    if (input.descriptionOrRules !== true) {
      reasons.push('A description or rules are required for documentary publication.');
    }
    if (input.marketOrAssets !== true) {
      reasons.push('An asset or market is required for documentary publication.');
    }
    if (input.provenanceValid !== true) {
      reasons.push('Valid provenance is required for documentary publication.');
    }
    if (input.validationStatusCompatible !== true) {
      reasons.push('validationStatus is not compatible with publication.');
    }
    if (input.limitations !== true) {
      reasons.push('Limitations are required for documentary publication.');
    }
    if (input.evidenceAvailable !== true) {
      reasons.push('An identifiable source or authorized evidence is required for documentary publication.');
    }
    return { publish: reasons.length === 0, reasons };
  }

  // Results mode.
  // Mock strategies are demo fixtures and are not filtered by performance.
  if (input.dataStatus === 'mock') {
    return { publish: reasons.length === 0, reasons };
  }

  if (typeof input.profitFactor !== 'number' || !Number.isFinite(input.profitFactor)) {
    reasons.push('Profit Factor is missing.');
  } else if (input.profitFactor < MIN_PROFIT_FACTOR) {
    reasons.push(
      `Profit Factor ${input.profitFactor.toFixed(4)} is below the ${MIN_PROFIT_FACTOR.toFixed(2)} beta-1 threshold.`,
    );
  }

  if (typeof input.trades !== 'number' || !Number.isFinite(input.trades) || input.trades < 1) {
    reasons.push('No closed trades are available.');
  }

  if (typeof input.equityPointCount !== 'number' || input.equityPointCount < 2) {
    reasons.push('The equity curve has fewer than 2 points.');
  }

  if (!input.periodStart && !input.periodEnd) {
    reasons.push('The analyzed period is missing.');
  }

  if (typeof input.maxDrawdownUsd !== 'number' || !Number.isFinite(input.maxDrawdownUsd)) {
    reasons.push('The maximum drawdown is missing.');
  }

  if (typeof input.costsApplied !== 'boolean') {
    reasons.push('costsApplied must be explicitly defined (true or false).');
  }

  return { publish: reasons.length === 0, reasons };
}
