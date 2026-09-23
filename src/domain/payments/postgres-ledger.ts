/**
 * QNT-0042 · Postgres payment ledger (Neon serverless over HTTP).
 *
 * Server-only. Imported lazily from `./ledger` so the Neon client never enters
 * the client bundle. Every statement is parameterized; no price ever comes from
 * the client — the amount is read from the active plan row (the catalog is
 * synced into `plans` by the migration), and provider references stay in
 * server-only columns.
 *
 * Status mapping (database <-> checkout state machine):
 *   pending_payment -> pending   | draft -> pending     | failed -> cancelled
 *   paid (+ purchase) -> paid    | paid (+ rental) -> active
 *   cancelled/expired -> cancelled                       | refunded -> refunded
 */
import { sql } from '../../db';
import { RENTAL_PERIOD_MS } from '../delivery/access';
import type { CheckoutRecord, CheckoutRecordStatus } from './checkout';
import { applyEventWith, type LedgerEvent, type LedgerOrderDraft, type PaymentLedger } from './ledger';

type Row = Record<string, unknown>;

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
const textOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);
const numOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

function toRecordStatus(status: string, billingModel: string | null): CheckoutRecordStatus {
  switch (status) {
    case 'paid':
      return billingModel === 'rental' ? 'active' : 'paid';
    case 'refunded':
      return 'refunded';
    case 'cancelled':
    case 'expired':
    case 'failed':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function toDbStatus(record: CheckoutRecord): string {
  switch (record.status) {
    case 'paid':
    case 'active':
      return 'paid';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    default:
      return 'pending_payment';
  }
}

/** Resolves (creating when needed) the customer row for an auth user. */
async function ensureCustomerId(authUserId: string, email: string | null): Promise<string | null> {
  const inserted = (await sql()`
    INSERT INTO customers (auth_user_id, email, display_name, role, status)
    VALUES (${authUserId}, ${email}, NULL, 'customer', 'pending')
    ON CONFLICT DO NOTHING
    RETURNING customer_id
  `) as Row[];
  if (inserted.length > 0) return text(inserted[0].customer_id);
  const found = (await sql()`
    SELECT customer_id FROM customers WHERE auth_user_id = ${authUserId} LIMIT 1
  `) as Row[];
  return found.length > 0 ? text(found[0].customer_id) : null;
}

type PlanTarget = { productRef: string; planId: string; amountMinor: number; currency: string };

/** Active plan of a product: the price always comes from the database row. */
async function resolvePlanTarget(productId: string, billingModel: string): Promise<PlanTarget | null> {
  const rows = (await sql()`
    SELECT p.id AS product_ref, pl.plan_id, pl.price_amount_minor, pl.currency
    FROM products p
    JOIN plans pl ON pl.product_ref = p.id
    WHERE p.product_id = ${productId}
      AND pl.billing_model = ${billingModel}
      AND pl.status = 'active'
      AND pl.price_amount_minor > 0
      AND pl.currency IS NOT NULL
    LIMIT 1
  `) as Row[];
  if (rows.length === 0) return null;
  const row = rows[0];
  const amount = numOrNull(row.price_amount_minor);
  const currency = textOrNull(row.currency);
  if (amount === null || currency === null) return null;
  return {
    productRef: text(row.product_ref),
    planId: text(row.plan_id),
    amountMinor: amount,
    currency,
  };
}

/** Exported for tests: the pure mapping between database and checkout states. */
export const __statusMapping = { toRecordStatus, toDbStatus };

export function createPostgresLedger(_url?: string): PaymentLedger {
  const ledger: PaymentLedger = {
    kind: 'postgres',

    /** Creates the pending order; the amount is always the stored plan price. */
    async createOrder(draft: LedgerOrderDraft): Promise<CheckoutRecord> {
      const target = await resolvePlanTarget(draft.productId, draft.billingModel);
      if (!target) {
        throw new Error('checkout_not_persistable: unknown product or no active plan');
      }
      const customerId = await ensureCustomerId(draft.customerAuthUserId, draft.customerEmail);
      if (!customerId) {
        throw new Error('checkout_not_persistable: customer could not be resolved');
      }
      const rows = (await sql()`
        INSERT INTO orders (
          customer_id, product_ref, plan_id, status, amount_minor, currency, billing_model, stripe_session_id
        )
        VALUES (
          ${customerId}, ${target.productRef}, ${target.planId}, 'pending_payment',
          ${target.amountMinor}, ${target.currency}, ${draft.billingModel}, ${draft.stripeSessionId}
        )
        RETURNING order_id, created_at, updated_at
      `) as Row[];
      const row = rows[0] ?? {};
      const createdAt = iso(row.created_at, new Date().toISOString());
      return {
        orderId: text(row.order_id),
        customerId,
        productId: draft.productId,
        billingModel: draft.billingModel,
        amountMinor: target.amountMinor,
        currency: target.currency,
        status: 'pending',
        stripeSessionId: draft.stripeSessionId,
        stripeEventIds: [],
        createdAt,
        updatedAt: iso(row.updated_at, createdAt),
      };
    },

    async findByOrderId(orderId: string): Promise<CheckoutRecord | null> {
      if (!isUuid(orderId)) return null;
      const rows = (await sql()`
        SELECT o.order_id, o.customer_id, o.status, o.amount_minor, o.currency, o.billing_model,
               o.stripe_session_id, o.created_at, o.updated_at, p.product_id,
               (SELECT array_agg(e.event_id) FROM stripe_events e WHERE e.order_id = o.order_id) AS event_ids
        FROM orders o
        JOIN products p ON p.id = o.product_ref
        WHERE o.order_id = ${orderId}
        LIMIT 1
      `) as Row[];
      return rows.length > 0 ? rowToRecord(rows[0]) : null;
    },

    async findBySessionId(sessionId: string): Promise<CheckoutRecord | null> {
      const rows = (await sql()`
        SELECT o.order_id, o.customer_id, o.status, o.amount_minor, o.currency, o.billing_model,
               o.stripe_session_id, o.created_at, o.updated_at, p.product_id,
               (SELECT array_agg(e.event_id) FROM stripe_events e WHERE e.order_id = o.order_id) AS event_ids
        FROM orders o
        JOIN products p ON p.id = o.product_ref
        WHERE o.stripe_session_id = ${sessionId}
        LIMIT 1
      `) as Row[];
      return rows.length > 0 ? rowToRecord(rows[0]) : null;
    },

    /** Persists the new state and mirrors it into `payments`. */
    async saveOrder(record: CheckoutRecord): Promise<void> {
      await sql()`
        UPDATE orders
        SET status = ${toDbStatus(record)},
            billing_model = ${record.billingModel},
            stripe_session_id = COALESCE(${record.stripeSessionId}, stripe_session_id),
            updated_at = now()
        WHERE order_id = ${record.orderId}
      `;
      const paymentStatus =
        record.status === 'paid' || record.status === 'active'
          ? 'succeeded'
          : record.status === 'refunded'
            ? 'refunded'
            : record.status === 'cancelled'
              ? 'cancelled'
              : 'pending';
      await sql()`
        INSERT INTO payments (order_id, provider, provider_reference, status, amount_minor, currency)
        VALUES (${record.orderId}, 'stripe', NULL, ${paymentStatus}, ${record.amountMinor}, ${record.currency})
        ON CONFLICT (order_id, provider) WHERE provider IS NOT NULL
        DO UPDATE SET status = EXCLUDED.status, updated_at = now()
      `;
    },

    async listByCustomer(customerAuthUserId: string): Promise<CheckoutRecord[]> {
      const rows = (await sql()`
        SELECT o.order_id, o.customer_id, o.status, o.amount_minor, o.currency, o.billing_model,
               o.stripe_session_id, o.created_at, o.updated_at, p.product_id,
               (SELECT array_agg(e.event_id) FROM stripe_events e WHERE e.order_id = o.order_id) AS event_ids
        FROM orders o
        JOIN products p ON p.id = o.product_ref
        JOIN customers c ON c.customer_id = o.customer_id
        WHERE c.auth_user_id = ${customerAuthUserId}
        ORDER BY o.created_at DESC
        LIMIT 50
      `) as Row[];
      return rows.map(rowToRecord);
    },

    async hasProcessedEvent(eventId: string): Promise<boolean> {
      if (eventId.length === 0) return false;
      const rows = (await sql()`
        SELECT 1 FROM stripe_events WHERE event_id = ${eventId} LIMIT 1
      `) as Row[];
      return rows.length > 0;
    },

    async recordEvent(event: LedgerEvent): Promise<void> {
      const orderId = isUuid(event.orderId) ? event.orderId : null;
      await sql()`
        INSERT INTO stripe_events (event_id, event_type, order_id, applied)
        VALUES (${event.eventId}, ${event.type}, ${orderId}, true)
        ON CONFLICT (event_id) DO NOTHING
      `;
      if (orderId && event.providerReference) {
        await sql()`
          UPDATE orders
          SET provider_reference = ${event.providerReference}, updated_at = now()
          WHERE order_id = ${orderId}
        `;
      }
    },

    async applyEvent(event: LedgerEvent) {
      return applyEventWith(ledger, event);
    },

    /**
     * QNT-0043 · Latest license with an entitlement for a product and customer.
     * Used by the download endpoint: the newest access wins.
     */
    async activeDownloadAccess(customerAuthUserId: string, productId: string) {
      const rows = (await sql()`
        SELECT l.license_id, l.order_id, l.status AS license_status, l.expires_at,
               e.status AS entitlement_status, e.can_download
        FROM customers c
        JOIN licenses l ON l.customer_id = c.customer_id
        JOIN products p ON p.id = l.product_ref AND p.product_id = ${productId}
        LEFT JOIN entitlements e ON e.license_id = l.license_id
        WHERE c.auth_user_id = ${customerAuthUserId}
        ORDER BY l.created_at DESC
        LIMIT 1
      `) as Row[];
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        license: {
          licenseId: text(row.license_id),
          orderId: text(row.order_id),
          status: text(row.license_status),
          expiresAt: iso(row.expires_at, '') === '' ? null : iso(row.expires_at, ''),
        },
        entitlement: {
          status: text(row.entitlement_status),
          canDownload: row.can_download === true,
        },
      };
    },

    /**
     * QNT-0043 · Grants a license + entitlement from a paid/active order.
     * Idempotent per order: a second call for the same order id refreshes
     * nothing and keeps a single active license and entitlement.
     */
    async grantAccessFromOrder(orderId: string, rentalPeriodMs?: number) {
      if (!isUuid(orderId)) return;
      const period = rentalPeriodMs ?? RENTAL_PERIOD_MS;
      await sql()`
        WITH settled AS (
          SELECT o.order_id, o.customer_id, o.product_ref, o.billing_model, o.status
          FROM orders o
          WHERE o.order_id = ${orderId} AND o.status = 'paid'
          LIMIT 1
        ),
        license AS (
          INSERT INTO licenses (customer_id, product_ref, order_id, status, starts_at, expires_at)
          SELECT s.customer_id, s.product_ref, s.order_id, 'active', now(),
                 CASE WHEN s.billing_model = 'rental' THEN now() + (${period}::bigint * INTERVAL '1 millisecond') ELSE NULL END
          FROM settled s
          ON CONFLICT DO NOTHING
          RETURNING license_id, customer_id, product_ref
        )
        INSERT INTO entitlements (customer_id, product_ref, license_id, status, can_download, can_view_customer_content)
        SELECT license.customer_id, license.product_ref, license.license_id, 'granted', true, false
        FROM license
        ON CONFLICT DO NOTHING
      `;
    },

    /** QNT-0043 · Database product state from the products table. */
    async productState(productId: string) {
      const rows = (await sql()`
        SELECT status, commercial_download_enabled
        FROM products
        WHERE product_id = ${productId}
        LIMIT 1
      `) as Row[];
      if (rows.length === 0) return null;
      return {
        status: text(rows[0].status),
        commercialDownloadEnabled: rows[0].commercial_download_enabled === true,
      };
    },

    /** QNT-0043 · Appends an audit row for every served download. */
    async recordDownloadDownloaded(
      customerAuthUserId: string,
      productId: string,
      licenseId: string | null,
      orderId: string | null,
    ) {
      const customers = (await sql()`
        SELECT customer_id FROM customers WHERE auth_user_id = ${customerAuthUserId} LIMIT 1
      `) as Row[];
      const customerId = customers.length > 0 ? text(customers[0].customer_id) : null;
      await sql()`
        INSERT INTO download_events (customer_id, product_id, license_id, order_id)
        VALUES (${customerId}, ${productId}, ${isUuid(licenseId) ? licenseId : null}, ${isUuid(orderId) ? orderId : null})
      `;
    },
  };

  return ledger;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Timestamps arrive as JS Dates over the Neon HTTP driver: normalize them. */
function iso(value: unknown, fallback: string): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  return fallback;
}

function rowToRecord(row: Row): CheckoutRecord {
  const billing = textOrNull(row.billing_model);
  return {
    orderId: text(row.order_id),
    customerId: text(row.customer_id),
    productId: text(row.product_id),
    billingModel: billing === 'rental' ? 'rental' : 'purchase',
    amountMinor: numOrNull(row.amount_minor) ?? 0,
    currency: text(row.currency),
    status: toRecordStatus(text(row.status), billing),
    stripeSessionId: textOrNull(row.stripe_session_id),
    stripeEventIds: Array.isArray(row.event_ids) ? (row.event_ids as unknown[]).map(String) : [],
    createdAt: iso(row.created_at, new Date(0).toISOString()),
    updatedAt: iso(row.updated_at, new Date(0).toISOString()),
  };
}
