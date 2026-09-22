/**
 * QNT-0042 · Stripe webhook + persistence contract tests (offline, no network).
 *
 * Proves, without a database or Stripe account:
 *   - the webhook verifies the signature BEFORE parsing the body;
 *   - the ledger is idempotent by Stripe event id (a replay changes nothing);
 *   - purchase -> paid and rental -> active, refund/cancel behave as defined;
 *   - an event for an unknown order is recorded but grants nothing;
 *   - fail closed: production without DATABASE_URL has no ledger at all, while
 *     development falls back to memory;
 *   - the SQL migration carries the ledger table, the unique keys and the
 *     owner-fixed prices (300 EUR / 10 EUR per month).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canGrantAccessFromSuccessPage,
  type CheckoutRecord,
  type CheckoutRecordStatus,
} from '../src/domain/payments/checkout';
import { RENTAL_PERIOD_MS, canFetchDownload } from '../src/domain/delivery/access';
import type { EntitlementStatus } from '../src/domain/commercial/entitlement';
import type { LicenseStatus } from '../src/domain/commercial/license';
import {
  createMemoryLedger,
  getMemoryLedger,
  getPaymentLedger,
  setMemoryProductState,
} from '../src/domain/payments/ledger';
import { verifyStripeSignature } from '../src/domain/payments/webhook';

let failures = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) console.log(`ok - ${name}`);
  else {
    failures++;
    console.error(`FAIL - ${name} ${extra}`);
  }
}

const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

const draft = (billingModel: 'purchase' | 'rental') => ({
  customerAuthUserId: 'auth-user-1',
  customerEmail: 'buyer@example.com',
  productId: 'first-triangle-ustec-m30',
  billingModel,
  amountMinor: billingModel === 'purchase' ? 30000 : 1000,
  currency: 'EUR',
  stripeSessionId: 'cs_test_1',
});

// ---------------------------------------------------------------------------
// 1. Webhook route: signature verified before the body is parsed
// ---------------------------------------------------------------------------
const route = read('src/routes/api/stripe/webhook.ts');
const verifyAt = route.indexOf('verifyStripeSignature(rawBody');
const parseAt = route.indexOf('JSON.parse(rawBody)');
check('webhook verifies the signature over the raw body', verifyAt > 0);
check('webhook parses the body only after verifying the signature', parseAt > verifyAt && parseAt > 0);
check('webhook refuses to run without a webhook secret', route.includes('webhook_not_configured'));
check('webhook refuses to run without persistence', route.includes('ledger_not_configured'));
check('webhook never touches the success page rule', !route.includes('canGrantAccessFromSuccessPage'));
check('success page still grants nothing', canGrantAccessFromSuccessPage() === false);
check('empty webhook secret never verifies', (await verifyStripeSignature('{}', 't=1,v1=abc', '')).ok === false);

// ---------------------------------------------------------------------------
// 2. Ledger: order lifecycle and idempotency
// ---------------------------------------------------------------------------
const ledger = createMemoryLedger();
const purchase = await ledger.createOrder(draft('purchase'));
check('checkout creates a pending order', purchase.status === 'pending' && purchase.amountMinor === 30000);
check('order carries the session id', purchase.stripeSessionId === 'cs_test_1');
check('order is findable by id', (await ledger.findByOrderId(purchase.orderId))?.orderId === purchase.orderId);
check('order is findable by session', (await ledger.findBySessionId('cs_test_1'))?.orderId === purchase.orderId);

const paid = await ledger.applyEvent({
  eventId: 'evt_1',
  type: 'checkout.session.completed',
  orderId: purchase.orderId,
  providerReference: 'cs_test_1',
});
check('purchase becomes paid', paid.ok === true && paid.applied === true && paid.record.status === 'paid');

const replay = await ledger.applyEvent({
  eventId: 'evt_1',
  type: 'checkout.session.completed',
  orderId: purchase.orderId,
});
check('replayed event is a no-op', replay.ok === false && replay.reason === 'event_already_processed');
check('state survives the replay', (await ledger.findByOrderId(purchase.orderId))?.status === 'paid');

const refund = await ledger.applyEvent({ eventId: 'evt_2', type: 'charge.refunded', orderId: purchase.orderId });
check('refund moves a paid order to refunded', refund.ok === true && refund.record.status === 'refunded');

const rental = await ledger.createOrder(draft('rental'));
const active = await ledger.applyEvent({ eventId: 'evt_3', type: 'invoice.paid', orderId: rental.orderId });
check('rental becomes active', active.ok === true && active.record.status === 'active');

const expiring = await ledger.createOrder({ ...draft('rental'), stripeSessionId: 'cs_test_2' });
const cancelled = await ledger.applyEvent({
  eventId: 'evt_4',
  type: 'checkout.session.expired',
  orderId: expiring.orderId,
});
check('expired session cancels the order', cancelled.ok === true && cancelled.record.status === 'cancelled');

const unknown = await ledger.applyEvent({ eventId: 'evt_5', type: 'checkout.session.completed', orderId: null });
check('event without an order grants nothing', unknown.ok === false && unknown.reason === 'order_not_found');
check('unknown event is still recorded (replay stays a no-op)', await ledger.hasProcessedEvent('evt_5'));

const foreign = await ledger.applyEvent({
  eventId: 'evt_6',
  type: 'checkout.session.completed',
  orderId: '00000000-0000-4000-8000-000000000000',
});
check('event for an unknown order grants nothing', foreign.ok === false && foreign.reason === 'order_not_found');

const mine = await ledger.listByCustomer('auth-user-1');
check('customer history lists their own orders only', mine.length === 3);
check('history is newest first', mine[0]!.createdAt >= mine[mine.length - 1]!.createdAt);
check('another customer sees nothing', (await ledger.listByCustomer('someone-else')).length === 0);

// ---------------------------------------------------------------------------
// 2b. Download access: paid orders grant licenses, rules deny by default
// ---------------------------------------------------------------------------
const granted = await ledger.createOrder({
  ...draft('purchase'),
  customerAuthUserId: 'auth-buyer',
  stripeSessionId: 'cs_grant_1',
});
await ledger.applyEvent({ eventId: 'evt_grant', type: 'checkout.session.completed', orderId: granted.orderId });
await ledger.applyEvent({ eventId: 'evt_grant_replay', type: 'checkout.session.completed', orderId: granted.orderId });
const buyerAccess = await ledger.activeDownloadAccess('auth-buyer', granted.productId);
check('paid order grants one active license', buyerAccess?.license.status === 'active');
check(
  'granted entitlement allows downloads',
  buyerAccess?.entitlement.status === 'granted' && buyerAccess?.entitlement.canDownload === true,
);
check(
  'one-time purchase license has no expiry',
  buyerAccess !== null && buyerAccess.license.expiresAt === null,
);

const rented = await ledger.createOrder({
  ...draft('rental'),
  customerAuthUserId: 'auth-renter',
  stripeSessionId: 'cs_grant_2',
});
await ledger.applyEvent({ eventId: 'evt_grant_r', type: 'invoice.paid', orderId: rented.orderId });
const renterAccess = await ledger.activeDownloadAccess('auth-renter', rented.productId);
check('rental maps to an active license', renterAccess?.license.status === 'active');
check(
  'rental license carries a finite term',
  renterAccess !== null &&
    typeof renterAccess.license.expiresAt === 'string' &&
    Date.parse(renterAccess.license.expiresAt) - Date.parse(rented.createdAt) === RENTAL_PERIOD_MS,
);

const canary = 'qnt-temp-product';
const denied = canFetchDownload({
  product: { status: 'coming_soon', commercialDownloadEnabled: false },
  license: renterAccess?.license
    ? { status: renterAccess.license.status as LicenseStatus, expiresAt: renterAccess.license.expiresAt }
    : null,
  entitlement: renterAccess
    ? {
        status: renterAccess.entitlement.status as EntitlementStatus,
        canDownload: renterAccess.entitlement.canDownload,
      }
    : null,
});
check('coming_soon denies even a valid license', denied.allowed === false && denied.reason.includes('not available'));

const live = {
  product: { status: 'available' as const, commercialDownloadEnabled: true },
  license: renterAccess?.license
    ? { status: renterAccess.license.status as 'active', expiresAt: renterAccess.license.expiresAt }
    : null,
  entitlement: renterAccess
    ? { status: renterAccess.entitlement.status as 'granted', canDownload: renterAccess.entitlement.canDownload }
    : null,
};
check('available product with an active grant allows', canFetchDownload(live).allowed === true);

const expired = canFetchDownload({
  ...live,
  license: live.license ? { ...live.license, expiresAt: new Date(Date.now() - 1000).toISOString() } : null,
});
check('expired rental denies', expired.allowed === false && expired.reason.includes('expired'));

const suspended = canFetchDownload({
  ...live,
  entitlement: { status: 'suspended', canDownload: true },
});
check('suspended entitlement denies', suspended.allowed === false && suspended.reason.includes('not granted'));

const anonymous = canFetchDownload({ ...live, license: null });
check('no license denies', anonymous.allowed === false && anonymous.reason.includes('no license'));

const stranger = await ledger.activeDownloadAccess('nobody', canary);
check('unknown customer has no access', stranger === null);

// ---------------------------------------------------------------------------
// 2c. Memory product state mirrors the published catalog in development
// ---------------------------------------------------------------------------
const mirrorLedger = createMemoryLedger();
await mirrorLedger.applyEvent({
  eventId: 'evt_dev',
  type: 'checkout.session.completed',
  orderId: 'no-order-here',
});
setMemoryProductState(mirrorLedger, { productId: canary, status: 'available', commercialDownloadEnabled: true });
check('mirrored product state resolves', (await mirrorLedger.productState(canary))?.status === 'available');
check('unknown products deny by default', (await mirrorLedger.productState('anything-else')) === null);
check('the memory fallback is not the production path', getMemoryLedger().kind === 'memory');

// ---------------------------------------------------------------------------
// 3. Fail closed: production without a database has no ledger at all
// ---------------------------------------------------------------------------
const savedEnv = process.env.APP_ENV;
const savedDb = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

process.env.APP_ENV = 'production';
check('production without DATABASE_URL has no ledger', (await getPaymentLedger()) === null);

process.env.APP_ENV = 'development';
const devLedger = await getPaymentLedger();
check(
  'development falls back to the in-memory ledger',
  devLedger !== null && devLedger.kind === 'memory',
);

if (savedEnv === undefined) delete process.env.APP_ENV;
else process.env.APP_ENV = savedEnv;
if (savedDb === undefined) delete process.env.DATABASE_URL;
else process.env.DATABASE_URL = savedDb;

// ---------------------------------------------------------------------------
// 4. Database <-> checkout status mapping (Postgres ledger)
// ---------------------------------------------------------------------------
const { __statusMapping } = await import('../src/domain/payments/postgres-ledger');
const dbStatus = (status: CheckoutRecordStatus): string =>
  __statusMapping.toDbStatus({ status } as unknown as CheckoutRecord);

check('database paid + purchase maps to paid', __statusMapping.toRecordStatus('paid', 'purchase') === 'paid');
check('database paid + rental maps to active', __statusMapping.toRecordStatus('paid', 'rental') === 'active');
check('database refunded maps to refunded', __statusMapping.toRecordStatus('refunded', 'purchase') === 'refunded');
check(
  'cancelled / expired / failed map to cancelled',
  __statusMapping.toRecordStatus('cancelled', null) === 'cancelled' &&
    __statusMapping.toRecordStatus('expired', null) === 'cancelled' &&
    __statusMapping.toRecordStatus('failed', null) === 'cancelled',
);
check(
  'pending database states map to pending',
  __statusMapping.toRecordStatus('pending_payment', null) === 'pending' &&
    __statusMapping.toRecordStatus('draft', null) === 'pending',
);
check(
  'checkout states map back to database states',
  dbStatus('pending') === 'pending_payment' &&
    dbStatus('paid') === 'paid' &&
    dbStatus('active') === 'paid' &&
    dbStatus('refunded') === 'refunded' &&
    dbStatus('cancelled') === 'cancelled',
);

// ---------------------------------------------------------------------------
// 5. Migration contract: idempotency table, unique keys, fixed prices
// ---------------------------------------------------------------------------
const migration = read('db/migrations/live/002_stripe_webhook.sql');
check('migration creates the processed-event ledger', migration.includes('CREATE TABLE IF NOT EXISTS stripe_events'));
check('the event id is the primary key (idempotency)', /event_id\s+text PRIMARY KEY/.test(migration));
check('migration adds the Stripe session column', migration.includes('stripe_session_id'));
check('unique session index is partial (nulls allowed)', migration.includes('WHERE stripe_session_id IS NOT NULL'));
check(
  'payment row key is unique per (order, provider)',
  migration.includes('ON payments (order_id, provider) WHERE provider IS NOT NULL'),
);
const postgresLedger = read('src/domain/payments/postgres-ledger.ts');
check(
  'the ledger upserts payments on that same key',
  postgresLedger.includes('ON CONFLICT (order_id, provider) WHERE provider IS NOT NULL'),
);
check(
  'the ledger never trusts a client amount',
  postgresLedger.includes('resolvePlanTarget') && postgresLedger.includes('pl.price_amount_minor'),
);
check(
  'plans seed is idempotent',
  migration.includes('CROSS JOIN products') && migration.includes('NOT EXISTS ('),
);
check('migration carries the owner-fixed prices', migration.includes('30000') && migration.includes('1000'));
check('no other amount sneaks into the seed', !/\b(4900|9900|19900|29900|49000)\b/.test(migration));
check('RLS is closed on the new table', migration.includes('ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY'));
check(
  'privileges revoked for anon/authenticated',
  migration.includes('REVOKE ALL ON stripe_events FROM anon, authenticated'),
);
check('migration never enables payments', !/PAYMENTS_ENABLED\s*=\s*true/.test(migration));

if (failures > 0) {
  console.error(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('ALL WEBHOOK + PERSISTENCE CHECKS PASSED');
