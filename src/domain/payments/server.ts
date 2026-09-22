/**
 * QNT-0025 · Stripe Test Mode server function.
 *
 * createTestCheckoutSession: authenticated user + PAYMENTS_ENABLED +
 * server-side price resolution (the client never sends the amount).
 * Real Stripe Checkout Session via REST when STRIPE_SECRET_KEY (test) is
 * set; deterministic mock URL otherwise. Webhook: see
 * docs/QNT-0025-stripe-test.md (raw-body signature check, idempotent).
 */
import { createServerFn } from '@tanstack/react-start';
import type { Validator } from '@tanstack/router-core';
import { getFeatureFlags } from '../../config';
import { getAuthStatus } from '../auth/server';
import { applyStripeWebhookEvent, canGrantAccessFromSuccessPage, type CheckoutRecord } from './checkout';
import { getPaymentLedger } from './ledger';
import { isStripeTestBillingModel, resolveStripeTestPrice } from './prices';

export type TestCheckoutRequest = { productId: string; billingModel: 'purchase' | 'rental' };
export type TestCheckoutResult =
  | {
      ok: true;
      url: string;
      orderId: string;
      mode: 'stripe' | 'mock';
      amountMinor: number;
      currency: string;
      /** True only when the order was written to the database (not memory). */
      persisted: boolean;
    }
  | {
      ok: false;
      error:
        | 'auth_required'
        | 'payments_disabled'
        | 'invalid_product'
        | 'stripe_error'
        | 'ledger_unavailable';
      message: string;
    };

function typed<T>(): Validator<T | undefined, T> {
  return { parse: (input: T | undefined) => (input ?? ({} as T)) };
}

function serverEnv(): Record<string, string | undefined> {
  return typeof process === 'undefined' ? {} : process.env;
}

function isStripeTestKey(value: string | undefined): boolean {
  return Boolean(value && value.startsWith('sk_test_'));
}

async function createStripeSessionViaApi(args: {
  secretKey: string; mode: 'payment' | 'subscription'; amountMinor: number;
  currency: string; productId: string; billingModel: string; orderId: string;
  customerEmail: string | null; successUrl: string; cancelUrl: string;
}): Promise<{ url: string | null; id: string | null }> {
  const params = new URLSearchParams();
  params.set('mode', args.mode);
  params.set('success_url', `${args.successUrl}?order=${encodeURIComponent(args.orderId)}`);
  params.set('cancel_url', args.cancelUrl);
  params.set('client_reference_id', args.orderId);
  params.set('metadata[order_id]', args.orderId);
  params.set('metadata[product_id]', args.productId);
  params.set('metadata[billing_model]', args.billingModel);
  if (args.customerEmail) params.set('customer_email', args.customerEmail);
  params.set('line_items[0][price_data][currency]', args.currency.toLowerCase());
  params.set('line_items[0][price_data][product_data][name]', `Quantora — ${args.productId}`);
  params.set('line_items[0][price_data][unit_amount]', String(args.amountMinor));
  params.set('line_items[0][quantity]', '1');
  if (args.mode === 'subscription') {
    params.set('line_items[0][price_data][recurring][interval]', 'month');
  }
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) return { url: null, id: null };
  const json = (await res.json()) as { url?: string; id?: string };
  return {
    url: typeof json.url === 'string' ? json.url : null,
    id: typeof json.id === 'string' ? json.id : null,
  };
}

export const createTestCheckoutSession = createServerFn({ method: 'POST' })
  .validator(typed<TestCheckoutRequest>())
  .handler(async ({ data }): Promise<TestCheckoutResult> => {
    const input = data ?? ({} as TestCheckoutRequest);
    const env = serverEnv();
    if (!getFeatureFlags(env).paymentsEnabled) {
      return { ok: false, error: 'payments_disabled', message: 'Payments are not enabled.' };
    }
    const status = await getAuthStatus();
    if (!status.user) {
      return { ok: false, error: 'auth_required', message: 'Sign in to continue to checkout.' };
    }
    if (typeof input.productId !== 'string' || input.productId.trim() === '') {
      return { ok: false, error: 'invalid_product', message: 'Unknown product.' };
    }
    if (!isStripeTestBillingModel(input.billingModel)) {
      return { ok: false, error: 'invalid_product', message: 'Unknown billing model.' };
    }
    const price = resolveStripeTestPrice(input.billingModel);
    const productId = input.productId.trim();
    const appUrl = (env.APP_URL ?? '').replace(/\/$/, '') || 'http://localhost:3000';
    const successUrl = `${appUrl}/checkout/success`;
    const cancelUrl = `${appUrl}/checkout/cancel`;

    // QNT-0042: every checkout creates a pending order in the ledger first, so
    // the signed webhook has something to reconcile. Without persistence there
    // is no order to mark paid: the checkout refuses instead of taking money it
    // cannot track (fail closed in production).
    const ledger = await getPaymentLedger();
    if (!ledger) {
      return {
        ok: false,
        error: 'ledger_unavailable',
        message: 'Checkout requires persistence, which is not configured.',
      };
    }

    let record: CheckoutRecord;
    try {
      record = await ledger.createOrder({
        customerAuthUserId: status.user.id,
        customerEmail: status.user.email,
        productId,
        billingModel: input.billingModel,
        amountMinor: price.amountMinor,
        currency: price.currency,
        stripeSessionId: null,
      });
    } catch (error) {
      return {
        ok: false,
        error: 'invalid_product',
        message: error instanceof Error ? error.message : 'The order could not be created.',
      };
    }
    const orderId = record.orderId;
    const persisted = ledger.kind === 'postgres';

    const secretKey = env.STRIPE_SECRET_KEY;
    if (isStripeTestKey(secretKey)) {
      const created = await createStripeSessionViaApi({
        secretKey: secretKey as string, mode: price.mode, amountMinor: price.amountMinor,
        currency: price.currency, productId, billingModel: input.billingModel,
        orderId, customerEmail: status.user.email, successUrl, cancelUrl,
      });
      if (!created.url) {
        return { ok: false, error: 'stripe_error', message: 'Stripe test session could not be created.' };
      }
      await ledger.saveOrder({ ...record, stripeSessionId: created.id });
      return {
        ok: true, url: created.url, orderId, mode: 'stripe',
        amountMinor: price.amountMinor, currency: price.currency, persisted,
      };
    }
    return {
      ok: true, url: `${successUrl}?order=${encodeURIComponent(orderId)}&mock=1`,
      orderId, mode: 'mock', amountMinor: price.amountMinor, currency: price.currency, persisted,
    };
  });

export { applyStripeWebhookEvent, canGrantAccessFromSuccessPage };
export type { CheckoutRecord };
