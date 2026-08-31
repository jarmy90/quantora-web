/**
 * QNT-0015 · Demo monitoring server function.
 *
 * The only way the client can obtain a demo monitoring snapshot. Resolution
 * happens here (domain rules + pilot source), never in the UI: the client
 * receives an already-resolved connection state. There are no write
 * endpoints — nothing here can configure, connect to or store an MT5
 * connection. The feature flag stays off by default; while it is off the
 * pilot reports an honest `not_connected`.
 */
import { createServerFn } from '@tanstack/react-start';
import type { Validator } from '@tanstack/router-core';
import { getPublicFeatureFlags } from '../../config';
import { publicStrategies } from '../../catalog';
import { resolvePilotSnapshot } from './source';
import type { DemoMonitoringSnapshot } from './contracts';

type DemoMonitoringQuery = { strategyId: string };

/** Inline validator: passes the payload through with the declared shape. */
function typed<T>(): Validator<T | undefined, T> {
  return { parse: (input: T | undefined) => (input ?? ({} as T)) };
}

function payload<T>(data: T | undefined): T {
  if (data === undefined) throw new Error('Missing request payload');
  return data;
}

export const getDemoMonitoringSnapshot = createServerFn()
  .validator(typed<DemoMonitoringQuery>())
  .handler(async ({ data }): Promise<DemoMonitoringSnapshot> => {
    const input = payload(data);
    const strategyId = typeof input.strategyId === 'string' ? input.strategyId : '';
    const strategy = publicStrategies.find((s) => s.id === strategyId);
    const flags = getPublicFeatureFlags();

    // Feature flag off by default: the pilot reports not_connected and never
    // fabricates a connection or data.
    if (!flags.demoMonitoringEnabled) {
      return {
        strategyId,
        productId: strategy?.productId,
        sourceType: 'demo',
        declaredBoundary: 'demo',
        connectionStatus: 'not_connected',
        freshness: 'unknown',
        unavailableReason: 'The demo monitoring pilot is not enabled yet.',
      };
    }

    return resolvePilotSnapshot(strategyId, {
      publishedIds: publicStrategies.map((s) => s.id),
      productId: strategy?.productId,
    });
  });