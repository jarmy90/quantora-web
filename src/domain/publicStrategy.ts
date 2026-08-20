/**
 * QNT-0003 public strategy presentation contracts.
 *
 * These describe the *client-facing* representation of a strategy: only what
 * the catalog and detail pages may show. Internal editorial/provenance states
 * (`dataStatus`, `validationStatus`, `status`) are intentionally absent here —
 * they never reach the public bundle.
 *
 * The pipeline (`scripts/intake/`) generates `public-strategies/catalog.json`
 * from these types, and the frontend consumes that generated, versioned
 * dataset. Metrics are extracted/calculated from authorized source files, never
 * hand-written in components.
 */
import type { EquityPoint } from './types';

export type QuantoraScoreComponent = {
  key: string;
  label: string;
  /** Share of the final score this component contributes (0..1). */
  weight: number;
  /** Component score 0..100. */
  points: number;
  /** False when the underlying data was absent; such components are excluded and reduce confidence. */
  available: boolean;
  note?: string;
};

export type QuantoraScore = {
  /** Final score 0..100 (weighted over available components). */
  value: number;
  /** Fraction (0..1) of total weight that was actually available. */
  confidence: number;
  components: QuantoraScoreComponent[];
  /** Short, human-readable summary of the formula and its weights. */
  formula: string;
  /** Version of the score formula (e.g. "beta-1"). Experimental, not a validation. */
  version: string;
};

export type PublicationMode = 'documentary' | 'results';

export type PublicStrategy = {
  id: string;
  name: string;
  version?: string;
  tagline?: string;
  description?: string;
  type?: string;
  market?: string;
  instrument?: string;
  variant?: string;
  configuration?: string;
  assets: string[];
  period?: PublicPeriod;
  /** Public metrics (profitFactor, winRate, trades, frequencyPerMonth, drawdown, net, …). */
  metrics?: Record<string, number>;
  equity?: { currency?: string; points: EquityPoint[] };
  score?: QuantoraScore;
  rules?: string[];
  limitations?: string[];
  costs?: Record<string, string>;
  disclaimer?: string;
  // QNT-0003H public transparency (commercially safe; internal states stay private):
  /** Public review label, e.g. "Owner supplied". Never the internal validationStatus. */
  reviewLabel?: string;
  /** False until Quantora independently reproduces the strategy. */
  independentReproduction: boolean;
  /** True when the reported results already include commissions/spread/slippage costs. */
  costsApplied?: boolean;
  /** Version of the score formula ("beta-1"). */
  scoreVersion?: string;
  /** Version of the publication filter ("beta-1"). */
  filterVersion?: string;
  /** "documentary" (no results required) or "results" (performance required). */
  publicationMode?: PublicationMode;
};

export type PublicPeriod = {
  start?: string;
  end?: string;
  timeframe?: string;
};

export type PublicCatalog = {
  generatedAt: string;
  strategies: PublicStrategy[];
};
