/**
 * QNT-0045 · Customer licences server function.
 *
 * Read-only: returns the signed-in customer's licences with their keys and
 * expiry, so the account area can show "your key" and "valid until" without
 * any manual step after payment. With payments disabled, no session or no
 * persistence it returns an honest empty list and never throws to the client.
 */
import { createServerFn } from '@tanstack/react-start';
import { getFeatureFlags } from '../../config';
import { getAuthStatus } from '../auth/server';
import type { CustomerLicense } from '../payments/ledger';
import { getPaymentLedger } from '../payments/ledger';
import { commercialCatalog } from '../../commercial/catalog';

export type CustomerLicenseView = CustomerLicense & {
  displayName: string;
  /** True while the licence is active and not expired (server-side verdict). */
  usable: boolean;
};

function serverEnv(): Record<string, string | undefined> {
  return typeof process === 'undefined' ? {} : process.env;
}

function displayNameFor(productId: string): string {
  return commercialCatalog.find((entry) => entry.productId === productId)?.displayName ?? productId;
}

export const getMyLicenses = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ licenses: CustomerLicenseView[] }> => {
    if (!getFeatureFlags(serverEnv()).paymentsEnabled) return { licenses: [] };
    const status = await getAuthStatus();
    if (!status.user) return { licenses: [] };

    const ledger = await getPaymentLedger();
    if (!ledger) return { licenses: [] };

    const now = Date.now();
    const licenses = (await ledger.listLicenses(status.user.id)).map((license) => ({
      ...license,
      displayName: displayNameFor(license.productId),
      usable:
        license.status === 'active' &&
        (license.expiresAt === null || Date.parse(license.expiresAt) > now),
    }));
    return { licenses };
  },
);
