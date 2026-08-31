/**
 * QNT-0015 · Demo monitoring pilot source.
 *
 * A safe, replaceable pilot data source. Today the registry is EMPTY: no real
 * demo monitoring data has been supplied to the repository, so every strategy
 * resolves to an honest `not_connected` snapshot with no metrics. Balances,
 * equity, trades and returns are never synthesised, and backtest metrics are
 * never copied into the demo module.
 *
 * To replace this source with future server-side infrastructure, swap the
 * resolver inside `resolvePilotSnapshot`. Consumers (the server function and
 * the UI) do not change.
 */
import type { DemoMonitoringSnapshot } from './contracts';

/** Pilot registry: intentionally empty until real demo data is supplied. */
const PILOT_REGISTRY: Record<string, DemoMonitoringSnapshot> = {};

function notConnectedSnapshot(strategyId: string, productId?: string): DemoMonitoringSnapshot {
  return {
    strategyId,
    productId,
    sourceType: 'demo',
    declaredBoundary: 'demo',
    connectionStatus: 'not_connected',
    freshness: 'unknown',
    unavailableReason: 'No demo monitoring data has been supplied for this strategy yet.',
  };
}

/**
 * Resolve the pilot snapshot for a strategy. Always safe: unknown/unmapped
 * ids and strategies without supplied demo data return an honest
 * `not_connected` snapshot with no metrics and no invented values.
 */
export function resolvePilotSnapshot(
  strategyId: string,
  opts: { publishedIds: readonly string[]; productId?: string },
): DemoMonitoringSnapshot {
  if (!opts.publishedIds.includes(strategyId)) {
    return {
      ...notConnectedSnapshot(strategyId),
      unavailableReason: 'Unknown or unmapped strategy id.',
    };
  }
  const known = PILOT_REGISTRY[strategyId];
  if (known) return known;
  return notConnectedSnapshot(strategyId, opts.productId);
}