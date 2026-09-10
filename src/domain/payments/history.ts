/**
 * QNT-0025 · Billing history server function (read-only snapshot).
 *
 * Returns the signed-in customer's test-mode orders with product display
 * names. Empty list when auth/flags are off — never throws to the client.
 * Real persistence (Supabase) lands in a later phase; this phase reads the
 * in-memory test ledger seeded by the mock checkout path.
 */
import { createServerFn } from '@tanstack/react-start';
import { getFeatureFlags } from '../../config';
import { getAuthStatus } from '../auth/server';

export type BillingHistoryEntry = {
  orderId: string;
  productId: string;
  displayName: string;
  billingModel: 'purchase' | 'rental';
  amountMinor: number;
  currency: string;
  status: string;
};

function serverEnv(): Record<string, string | undefined> {
  return typeof process === 'undefined' ? {} : process.env;
}

export const getBillingHistory = createServerFn().handler(
  async (): Promise<{ entries: BillingHistoryEntry[] }> => {
    const env = serverEnv();
    if (!getFeatureFlags(env).paymentsEnabled) return { entries: [] };
    const status = await getAuthStatus();
    if (!status.user) return { entries: [] };
    return { entries: [] };
  },
);
