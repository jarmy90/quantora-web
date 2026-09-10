/**
 * QNT-0025 · Stripe Test Mode price contract.
 *
 * Fixed product decisions (DO NOT CHANGE without Javier's explicit approval):
 *   - Purchase: 300 EUR one-time
 *   - Rental: 10 EUR / month subscription
 *   - Currency: EUR
 *
 * Prices are resolved SERVER-SIDE only. The client never sends the final
 * amount — it only sends { productId, billingModel }. Nothing here touches
 * real money: Stripe keys come from server-only env vars and production
 * flags stay false (PAYMENTS_ENABLED=false in production).
 */
export const STRIPE_TEST_CURRENCY = 'EUR';

export const STRIPE_TEST_PRICES = {
  purchase: { amountMinor: 30000, currency: 'EUR', interval: 'one_time' as const },
  rental: { amountMinor: 1000, currency: 'EUR', interval: 'monthly' as const },
} as const;

export type StripeTestBillingModel = keyof typeof STRIPE_TEST_PRICES;

export function isStripeTestBillingModel(value: unknown): value is StripeTestBillingModel {
  return value === 'purchase' || value === 'rental';
}

/** Server-side price resolution: product + billing model -> fixed test price. */
export function resolveStripeTestPrice(billingModel: StripeTestBillingModel): {
  amountMinor: number;
  currency: string;
  mode: 'payment' | 'subscription';
} {
  const price = STRIPE_TEST_PRICES[billingModel];
  return {
    amountMinor: price.amountMinor,
    currency: price.currency,
    mode: billingModel === 'purchase' ? 'payment' : 'subscription',
  };
}

/** Human labels only — never sent to Stripe as amounts. */
export function stripeTestPriceLabel(billingModel: StripeTestBillingModel): string {
  if (billingModel === 'purchase') return '300 €';
  return '10 €/mo';
}
