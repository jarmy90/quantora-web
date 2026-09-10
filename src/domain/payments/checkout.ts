/**
 * QNT-0025 · Stripe Test Mode checkout state machine.
 *
 * Server-side only. Pure, non-throwing transitions:
 *   pending -> paid -> (active for rental) / cancelled / refunded
 *
 * `paid` is ONLY set by the signed Stripe webhook — never from client input,
 * never from the success page. Idempotency is by Stripe event id: an already
 * processed event id is a no-op (returns the unchanged state).
 */
export type CheckoutRecordStatus = 'pending' | 'paid' | 'active' | 'cancelled' | 'refunded';

export type CheckoutRecord = {
  orderId: string;
  customerId: string;
  productId: string;
  billingModel: 'purchase' | 'rental';
  amountMinor: number;
  currency: string;
  status: CheckoutRecordStatus;
  stripeSessionId: string | null;
  stripeEventIds: string[];
  createdAt: string;
  updatedAt: string;
};

export function applyStripeWebhookEvent(
  record: CheckoutRecord,
  event: { eventId: string; type: string },
): { record: CheckoutRecord; applied: boolean } {
  if (record.stripeEventIds.includes(event.eventId)) {
    return { record, applied: false };
  }
  const now = new Date().toISOString();
  const seen = [...record.stripeEventIds, event.eventId];
  if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
    if (record.status !== 'pending') return { record: { ...record, stripeEventIds: seen, updatedAt: now }, applied: false };
    const next: CheckoutRecordStatus = record.billingModel === 'rental' ? 'active' : 'paid';
    return { record: { ...record, status: next, stripeEventIds: seen, updatedAt: now }, applied: true };
  }
  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    if (record.status !== 'pending') return { record: { ...record, stripeEventIds: seen, updatedAt: now }, applied: false };
    return { record: { ...record, status: 'cancelled', stripeEventIds: seen, updatedAt: now }, applied: true };
  }
  if (event.type === 'charge.refunded' || event.type === 'charge.refund.updated') {
    if (record.status !== 'paid' && record.status !== 'active') {
      return { record: { ...record, stripeEventIds: seen, updatedAt: now }, applied: false };
    }
    return { record: { ...record, status: 'refunded', stripeEventIds: seen, updatedAt: now }, applied: true };
  }
  return { record: { ...record, stripeEventIds: seen, updatedAt: now }, applied: false };
}

/** The success page must never grant access: paid/active only comes from the webhook. */
export function canGrantAccessFromSuccessPage(): boolean {
  return false;
}
