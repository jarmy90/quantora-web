/**
 * QNT-0025 · Stripe Test Mode contract tests (offline, no network, no secrets).
 *
 * - Fixed prices: purchase 300 EUR one-time, rental 10 EUR/month, EUR only.
 * - Server-side price resolution (client never sends the amount).
 * - Webhook: signed over raw body, timestamp tolerance, idempotent by event id.
 * - Success page never grants access.
 * - Flags: payments stay disabled unless PAYMENTS_ENABLED=true (server-only).
 */
import { applyStripeWebhookEvent, canGrantAccessFromSuccessPage, type CheckoutRecord } from '../src/domain/payments/checkout';
import { isStripeTestBillingModel, resolveStripeTestPrice, STRIPE_TEST_CURRENCY } from '../src/domain/payments/prices';
import { verifyStripeSignature } from '../src/domain/payments/webhook';
import { getFeatureFlags } from '../src/config';
import { enUS } from '../src/i18n/index';
import { esES } from '../src/i18n/es-ES';

let failures = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) console.log(`ok - ${name}`);
  else {
    failures++;
    console.error(`FAIL - ${name} ${extra}`);
  }
}

function baseRecord(): CheckoutRecord {
  return {
    orderId: 'test_1', customerId: 'c1', productId: 'first-triangle-ustec-m30',
    billingModel: 'purchase', amountMinor: 30000, currency: 'EUR', status: 'pending',
    stripeSessionId: null, stripeEventIds: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

async function sign(secret: string, timestamp: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const purchase = resolveStripeTestPrice('purchase');
check('purchase price is 300 EUR one-time', purchase.amountMinor === 30000 && purchase.currency === 'EUR' && purchase.mode === 'payment');
const rental = resolveStripeTestPrice('rental');
check('rental price is 10 EUR monthly', rental.amountMinor === 1000 && rental.currency === 'EUR' && rental.mode === 'subscription');
check('currency is EUR', STRIPE_TEST_CURRENCY === 'EUR');
check('billing models validated', isStripeTestBillingModel('purchase') && isStripeTestBillingModel('rental') && !isStripeTestBillingModel('lifetime'));

const paid = applyStripeWebhookEvent(baseRecord(), { eventId: 'evt_1', type: 'checkout.session.completed' });
check('webhook purchase pending->paid', paid.applied && paid.record.status === 'paid');
const rentalRec = { ...baseRecord(), billingModel: 'rental' as const };
const active = applyStripeWebhookEvent(rentalRec, { eventId: 'evt_2', type: 'invoice.paid' });
check('webhook rental pending->active', active.applied && active.record.status === 'active');
const replay = applyStripeWebhookEvent(paid.record, { eventId: 'evt_1', type: 'checkout.session.completed' });
check('webhook idempotent on replay', !replay.applied && replay.record.status === 'paid');
check('success page never grants access', canGrantAccessFromSuccessPage() === false);

const secret = 'whsec_test_123';
const body = '{"id":"evt_1","type":"checkout.session.completed"}';
const ts = Math.floor(Date.now() / 1000);
const sig = await sign(secret, ts, body);
const verified = await verifyStripeSignature(body, `t=${ts},v1=${sig}`, secret);
check('valid signature accepted', verified.ok === true);
const tampered = await verifyStripeSignature(body + 'x', `t=${ts},v1=${sig}`, secret);
check('tampered body rejected', tampered.ok === false);
const stale = await verifyStripeSignature(body, `t=${ts - 3600},v1=${sig}`, secret);
check('stale timestamp rejected', stale.ok === false);

check('payments disabled by default', getFeatureFlags({}).paymentsEnabled === false);
check('payments enabled by server env only', getFeatureFlags({ PAYMENTS_ENABLED: 'true' }).paymentsEnabled === true);

const needed = ['checkout.testBadge', 'checkout.title', 'checkout.body', 'checkout.buy', 'checkout.rent', 'checkout.redirecting', 'checkout.unavailable', 'checkout.signInRequired', 'checkout.successTitle', 'checkout.successBody', 'checkout.goAccount', 'checkout.cancelTitle', 'checkout.cancelBody', 'billing.title', 'billing.empty'];
for (const key of needed) {
  check(`i18n EN has ${key}`, typeof (enUS as Record<string, string>)[key] === 'string' && (enUS as Record<string, string>)[key].length > 0);
  check(`i18n ES has ${key}`, typeof (esES as Record<string, string>)[key] === 'string' && (esES as Record<string, string>)[key].length > 0);
}

if (failures > 0) {
  console.error(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('ALL STRIPE TEST CHECKS PASSED');
