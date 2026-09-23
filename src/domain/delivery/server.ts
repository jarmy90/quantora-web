/**
 * QNT-0043 · Download access server function.
 *
 * Read-only view used by /account: "can I fetch this product right now?".
 * Every condition mirrors the endpoint's `canFetchDownload` decision, but this
 * function never produces a URL — the actual grant happens in the
 * `GET /api/downloads` route only.
 */
import { createServerFn } from '@tanstack/react-start';
import { getFeatureFlags } from '../../config';
import { getAuthStatus } from '../auth/server';
import type { EntitlementStatus } from '../commercial/entitlement';
import type { LicenseStatus } from '../commercial/license';
import type { ProductStatus } from '../commercial/product';
import { canFetchDownload } from './access';
import { getPaymentLedger } from '../payments/ledger';

export type DownloadAccessView = {
  allowed: boolean;
  reason: string;
};

function serverEnv(): Record<string, string | undefined> {
  return typeof process === 'undefined' ? {} : process.env;
}

type DownloadAccessRequest = { productIds?: string[] };

function toArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

export const getDownloadAccess = createServerFn({ method: 'GET' })
  .validator((input: unknown): DownloadAccessRequest => {
    const data = (input ?? {}) as { productIds?: unknown };
    return { productIds: toArray(data.productIds) };
  })
  .handler(async ({ data }): Promise<{ entries: Record<string, DownloadAccessView> }> => {
    const env = serverEnv();
    const denyAll = (reason: string): { entries: Record<string, DownloadAccessView> } => ({
      entries: Object.fromEntries(
        toArray(data?.productIds)
          .slice(0, 20)
          .map((productId) => [productId, { allowed: false, reason }] as const),
      ),
    });
    if (!getFeatureFlags(env).downloadsEnabled) return denyAll('downloads_disabled');
    const status = await getAuthStatus();
    if (!status.user) return denyAll('auth_required');
    const requested = toArray(data?.productIds).slice(0, 20);
    if (requested.length === 0) return { entries: {} };

    const ledger = await getPaymentLedger();
    if (!ledger) return denyAll('delivery_not_configured');

    const entries: Record<string, DownloadAccessView> = {};
    for (const productId of requested) {
      const product = await ledger.productState(productId);
      if (!product) {
        entries[productId] = { allowed: false, reason: 'unknown_product' };
        continue;
      }
      const access = await ledger.activeDownloadAccess(status.user.id, productId);
      const decision = canFetchDownload({
        product: {
          status: product.status as ProductStatus,
          commercialDownloadEnabled: product.commercialDownloadEnabled === true,
        },
        license: access
          ? { status: access.license.status as LicenseStatus, expiresAt: access.license.expiresAt }
          : null,
        entitlement: access
          ? {
              status: access.entitlement.status as EntitlementStatus,
              canDownload: access.entitlement.canDownload === true,
            }
          : null,
      });
      entries[productId] = { allowed: decision.allowed, reason: decision.reason };
    }
    return { entries };
  });
