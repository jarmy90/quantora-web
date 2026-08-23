/**
 * QNT-0012 · Customer contract (future shape only).
 *
 * No real customer records are ever created by this phase. No credentials,
 * passwords or hashing decisions live here — identity providers and hashing
 * are explicitly out of scope and will be decided in QNT-0013.
 *
 * email and displayName are nullable until QNT-0013 chooses the identity
 * mechanism; only that phase decides which fields become mandatory.
 */

export type CustomerRole = 'customer' | 'creator' | 'admin';

export type CustomerStatus = 'pending' | 'active' | 'suspended' | 'closed';

export const CUSTOMER_ROLES: readonly CustomerRole[] = ['customer', 'creator', 'admin'] as const;
export const CUSTOMER_STATUSES: readonly CustomerStatus[] = [
  'pending',
  'active',
  'suspended',
  'closed',
] as const;

export type Customer = {
  customerId: string;
  /** Personal data — never collected in this phase; nullable until auth lands. */
  email: string | null;
  displayName: string | null;
  role: CustomerRole;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
};

export function isCustomerRole(value: unknown): value is CustomerRole {
  return typeof value === 'string' && (CUSTOMER_ROLES as readonly string[]).includes(value);
}
