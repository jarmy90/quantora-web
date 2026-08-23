/**
 * QNT-0012 · License contract.
 *
 * A license grants a customer the right to use a product for a period. It can
 * never be `active` without a `paid` order. `startsAt`/`expiresAt` may be null
 * while pending, and `maxActivations` is never invented. MT5 account binding
 * is out of scope until a later phase.
 */

export type LicenseStatus = 'pending' | 'active' | 'grace_period' | 'expired' | 'revoked';

export const LICENSE_STATUSES: readonly LicenseStatus[] = [
  'pending',
  'active',
  'grace_period',
  'expired',
  'revoked',
] as const;

export type License = {
  licenseId: string;
  customerId: string;
  productId: string;
  orderId: string;
  status: LicenseStatus;
  /** Null while pending (no invented dates). */
  startsAt: string | null;
  expiresAt: string | null;
  /** Never invented — null until defined by a product/plan rule. */
  maxActivations: number | null;
  createdAt: string;
  updatedAt: string;
};

export function isLicenseStatus(value: unknown): value is LicenseStatus {
  return typeof value === 'string' && (LICENSE_STATUSES as readonly string[]).includes(value);
}
