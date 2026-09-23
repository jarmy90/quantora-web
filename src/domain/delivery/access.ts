/**
 * QNT-0043 · Protected download access rule.
 *
 * Pure, non-throwing decision for "may this customer fetch this product's EA
 * file right now?". It is the single rule used by the download endpoint; the
 * UI never decides access on its own.
 *
 * Defaults are deny: a product that is not `available`, a product whose
 * commercial download is disabled, a missing or non-active license, an
 * expired rental period, or a missing/non-granted entitlement all deny.
 * `nowMs` exists only so tests assert expiry deterministically.
 */
import type { EntitlementStatus } from '../commercial/entitlement';
import type { LicenseStatus } from '../commercial/license';
import type { ProductStatus } from '../commercial/product';

export type DownloadAccessInput = {
  product: {
    status: ProductStatus;
    commercialDownloadEnabled: boolean;
  };
  license: {
    status: LicenseStatus;
    /** ISO timestamp; null means no expiry (one-time purchase). */
    expiresAt: string | null;
  } | null;
  entitlement: {
    status: EntitlementStatus;
    canDownload: boolean;
  } | null;
  nowMs?: number;
};

export type DownloadDecision = {
  allowed: boolean;
  reason: string;
};

/** Default rental billing period (30 days), shared with the ledger. */
export const RENTAL_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export function canFetchDownload(input: DownloadAccessInput): DownloadDecision {
  if (input.product.status !== 'available') {
    return { allowed: false, reason: 'product is not available' };
  }
  if (input.product.commercialDownloadEnabled !== true) {
    return { allowed: false, reason: 'commercial download is not enabled for this product' };
  }
  if (!input.license) {
    return { allowed: false, reason: 'no license exists' };
  }
  if (input.license.status !== 'active') {
    return { allowed: false, reason: `license status "${input.license.status}" is not active` };
  }
  if (input.license.expiresAt !== null) {
    const expires = Date.parse(input.license.expiresAt);
    if (!Number.isFinite(expires) || expires <= (input.nowMs ?? Date.now())) {
      return { allowed: false, reason: 'license period has expired' };
    }
  }
  if (!input.entitlement) {
    return { allowed: false, reason: 'no entitlement exists' };
  }
  if (input.entitlement.status !== 'granted') {
    return { allowed: false, reason: `entitlement status "${input.entitlement.status}" is not granted` };
  }
  if (input.entitlement.canDownload !== true) {
    return { allowed: false, reason: 'entitlement does not allow downloads' };
  }
  return { allowed: true, reason: 'ok' };
}
