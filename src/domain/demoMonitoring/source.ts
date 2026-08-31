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
import { isSaneDemoMetrics, type DemoMonitoringSnapshot, type ResultsBoundary } from './contracts';

/**
 * Clamp any snapshot to the demo-only boundary before serving. A future
 * registry entry can never accidentally emit a different declared boundary
 * or unsanitized metrics: sourceType/declaredBoundary are always ‘demo’ and
 * metrics are only kept when they pass the domain sanity checks.
 */
export function sanitizePilotSnapshot(snapshot: DemoMonitoringSnapshot): DemoMonitoringSnapshot {
  return {
    ...snapshot,
    sourceType: 'demo',
    declaredBoundary: 'demo' as ResultsBoundary,
    metrics:
      snapshot.metrics !== undefined && isSaneDemoMetrics(snapshot.metrics)
        ? snapshot.metrics
        : undefined,
  };
}

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
  if (known) return sanitizePilotSnapshot(known);
  return sanitizePilotSnapshot(notConnectedSnapshot(strategyId, opts.productId));
}