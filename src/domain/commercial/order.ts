/**
 * QNT-0012 · Order contract.
 *
 * An order is the purchase intent for a product plan. `paid` can never be set
 * from client input — only a future server-side payment-confirmation path may
 * move an order to `paid`. Amount and currency are mandatory before an order
 * moves to `pending_payment`.
 */

export type OrderStatus =
  | 'draft'
  | 'pending_payment'
  | 'paid'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'failed';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'draft',
  'pending_payment',
  'paid',
  'cancelled',
  'expired',
  'refunded',
  'failed',
] as const;

export type Order = {
  orderId: string;
  customerId: string;
  productId: string;
  planId: string;
  status: OrderStatus;
  /** Minor units. Null only while a draft order is not being processed. */
  amountMinor: number | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}
