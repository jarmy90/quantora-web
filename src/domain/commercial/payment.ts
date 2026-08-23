/**
 * QNT-0012 · Payment contract.
 *
 * Provider-agnostic by design: no payment provider is chosen in this phase and
 * `provider` may be null. `providerReference` is the provider's external
 * reference and must never be returned to the public client bundle — it is a
 * server-side field only.
 */

export type PaymentStatus =
  | 'not_started'
  | 'pending'
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'not_started',
  'pending',
  'requires_action',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
] as const;

export type Payment = {
  paymentId: string;
  /** A succeeded payment always belongs to an order. */
  orderId: string | null;
  /** Provider identifier, e.g. "stripe". Null until a provider is chosen. */
  provider: string | null;
  /** Provider-side reference. Server-only — never exposed publicly. */
  providerReference: string | null;
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value);
}
