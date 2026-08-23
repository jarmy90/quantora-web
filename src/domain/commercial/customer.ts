/**
 * QNT-0012 · Customer contract (future shape only).
 *
 * No real customer records are ever created by this phase. No credentials,
 * passwords or hashing decisions live here — identity providers and hashing
 * are explicitly out of scope and will be decided in QNT-0013.
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
  /** Personal data — never collected in this phase. */
  email: string;
  displayName: string;
  role: CustomerRole;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
};

export function isCustomerRole(value: unknown): value is CustomerRole {
  return typeof value === 'string' && (CUSTOMER_ROLES as readonly string[]).includes(value);
}
