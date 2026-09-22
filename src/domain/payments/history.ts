/**
 * QNT-0042 · Billing history server function (read-only snapshot).
 *
 * Returns the signed-in customer's orders with product display names. Reads
 * from the payment ledger (Postgres when configured, memory in development);
 * with payments disabled, no session, or no persistence available it returns an
 * honest empty list — it never invents an order and never throws to the client.
 */
import { createServerFn } from '@tanstack/react-start';
import { getFeatureFlags } from '../../config';
import { getAuthStatus } from '../auth/server';
import { commercialCatalog } from '../../commercial/catalog';
import { getPaymentLedger } from './ledger';

export type BillingHistoryEntry = {
  orderId: string;
  productId: string;
  displayName: string;
  billingModel: 'purchase' | 'rental';
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
};

function serverEnv(): Record<string, string | undefined> {
  return typeof process === 'undefined' ? {} : process.env;
}

function displayNameFor(productId: string): string {
  return commercialCatalog.find((entry) => entry.productId === productId)?.displayName ?? productId;
}

export const getBillingHistory = createServerFn().handler(
  async (): Promise<{ entries: BillingHistoryEntry[] }> => {
    const env = serverEnv();
    if (!getFeatureFlags(env).paymentsEnabled) return { entries: [] };
    const status = await getAuthStatus();
    if (!status.user) return { entries: [] };

    const ledger = await getPaymentLedger();
    if (!ledger) return { entries: [] };

    const records = await ledger.listByCustomer(status.user.id);
    return {
      entries: records.map((record) => ({
        orderId: record.orderId,
        productId: record.productId,
        displayName: displayNameFor(record.productId),
        billingModel: record.billingModel,
        amountMinor: record.amountMinor,
        currency: record.currency,
        status: record.status,
        createdAt: record.createdAt,
      })),
    };
  },
);
