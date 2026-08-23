/**
 * QNT-0012 · Entitlement contract.
 *
 * An entitlement is the *effective* access permission derived from a license.
 * The UI must never make security decisions from these fields alone — the
 * final download/access check happens server-side in a future phase.
 */

export type EntitlementStatus = 'pending' | 'granted' | 'suspended' | 'expired' | 'revoked';

export const ENTITLEMENT_STATUSES: readonly EntitlementStatus[] = [
  'pending',
  'granted',
  'suspended',
  'expired',
  'revoked',
] as const;

export type Entitlement = {
  entitlementId: string;
  customerId: string;
  productId: string;
  licenseId: string;
  status: EntitlementStatus;
  /** False initially; only granted when every download condition holds. */
  canDownload: boolean;
  canViewCustomerContent: boolean;
  createdAt: string;
  updatedAt: string;
};

export function isEntitlementStatus(value: unknown): value is EntitlementStatus {
  return typeof value === 'string' && (ENTITLEMENT_STATUSES as readonly string[]).includes(value);
}
