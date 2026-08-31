/**
 * QNT-0015 · Demo monitoring contracts.
 *
 * Pilot for observing a clearly labelled *demo* account per real strategy.
 * The domain contract deliberately separates demo monitoring from historical
 * backtest results and from verified live results. No credentials, account
 * numbers, tokens, passwords, investor passwords or invented balances ever
 * belong here: metrics may only appear when real supplied demo data exists.
 */
export type DemoMonitoringStatus =
  | 'not_connected'
  | 'connecting'
  | 'live_demo'
  | 'stale'
  | 'offline';

export const DEMO_MONITORING_STATUSES: readonly DemoMonitoringStatus[] = [
  'not_connected',
  'connecting',
  'live_demo',
  'stale',
  'offline',
] as const;

export function isDemoMonitoringStatus(value: unknown): value is DemoMonitoringStatus {
  return (
    typeof value === 'string' &&
    (DEMO_MONITORING_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Deterministic freshness of demo data. `unknown` when no demo data was ever
 * supplied; `live` when the most recent demo update is inside the freshness
 * window; `stale` when the window has been exceeded. Derived from timestamps
 * only — never from presentation preferences.
 */
export type DemoFreshness = 'unknown' | 'live' | 'stale';

/**
 * Results boundary declared by the data source, never by the UI.
 * This module only ever produces `demo`; `verified_live` is not implemented.
 */
export type ResultsBoundary = 'backtest' | 'demo' | 'verified_live';

/**
 * Demo metrics. May only be populated from real supplied demo monitoring data;
 * amounts are integer minor units. Never synthesized by the application.
 */
export type DemoMonitoringMetrics = {
  balanceMinor?: number;
  equityMinor?: number;
  openTrades?: number;
  drawdownPct?: number;
  /** ISO 4217 code of the amounts, when reported. */
  currency?: string;
  /** ISO timestamp of the snapshot the metrics were reported from. */
  reportedAt: string;
};

/**
 * Read-only snapshot for a strategy's demo monitoring module, resolved
 * server-side. The client renders this snapshot; it never computes a
 * connection state on its own.
 */
export type DemoMonitoringSnapshot = {
  strategyId: string;
  /** Stable public product reference when the strategy has one. */
  productId?: string;
  sourceType: 'demo';
  /** Declared boundary. Always 'demo' for this module — never 'verified_live'. */
  declaredBoundary: ResultsBoundary;
  connectionStatus: DemoMonitoringStatus;
  freshness: DemoFreshness;
  /** ISO timestamp of the last supplied demo update. */
  lastUpdatedAt?: string;
  /** ISO timestamp when monitoring of this strategy was started. */
  monitoringStartedAt?: string;
  /** Optional, non-sensitive broker description (e.g. "Demo broker"). */
  brokerLabel?: string;
  /**
   * Optional, sanitised, non-identifying account label. Never a full account
   * number and never an investor password.
   */
  accountLabel?: string;
  /** Observation period/timeframe when supplied. */
  timeframe?: string;
  /** Demo metrics — present only when real demo data has been supplied. */
  metrics?: DemoMonitoringMetrics;
  /** Why no live demo data is shown right now (always truthful). */
  unavailableReason: string;
};