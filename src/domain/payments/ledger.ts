/**
 * QNT-0042 · Payment ledger.
 *
 * The only place where an order's paid/active state is persisted. Two
 * implementations ship: an in-memory one (unit tests and local development
 * without a database) and a Postgres one (Neon over HTTP, see
 * `./postgres-ledger`). Both share the same rules:
 *
 *   - `pending -> paid|active|cancelled|refunded` exactly as defined by the pure
 *     state machine in `./checkout` (no duplicated business logic);
 *   - idempotency by Stripe event id: an event is applied at most once;
 *   - fail closed: in production without a database there is NO ledger and the
 *     webhook refuses to record anything instead of granting access.
 *
 * QNT-0043 extends the contract with download access (license + entitlement),
 * granted from paid orders only. Product state in Postgres comes from the
 * products table; in memory the published catalog state is mirrored through
 * `setMemoryProductState` (integration code outside the ledger).
 */
import { RENTAL_PERIOD_MS } from '../delivery/access';
import { resolveAppEnv } from '../../config';
import { applyStripeWebhookEvent, type CheckoutRecord } from './checkout';

export type LedgerEvent = {
  eventId: string;
  type: string;
  orderId: string | null;
  /** Provider-side reference (server-only, never exposed publicly). */
  providerReference?: string | null;
};

export type LedgerApplyResult =
  | { ok: true; applied: boolean; record: CheckoutRecord; duplicate: boolean }
  | { ok: false; reason: 'event_already_processed' | 'order_not_found' };

export type LedgerOrderDraft = {
  /** Supabase auth user id — the ledger resolves/creates the customer row. */
  customerAuthUserId: string;
  customerEmail: string | null;
  productId: string;
  billingModel: 'purchase' | 'rental';
  amountMinor: number;
  currency: string;
  stripeSessionId: string | null;
};

export interface PaymentLedger {
  readonly kind: 'memory' | 'postgres';
  /** Creates a pending order (and the customer row when needed). */
  createOrder(draft: LedgerOrderDraft): Promise<CheckoutRecord>;
  findByOrderId(orderId: string): Promise<CheckoutRecord | null>;
  findBySessionId(sessionId: string): Promise<CheckoutRecord | null>;
  saveOrder(record: CheckoutRecord): Promise<void>;
  listByCustomer(customerAuthUserId: string): Promise<CheckoutRecord[]>;
  hasProcessedEvent(eventId: string): Promise<boolean>;
  recordEvent(event: LedgerEvent): Promise<void>;
  applyEvent(event: LedgerEvent): Promise<LedgerApplyResult>;
  /**
   * QNT-0043 · Latest license with an entitlement for a product and customer.
   * Returns null when access was never granted; the endpoint (not the UI)
   * decides what "can download" means with `canFetchDownload`.
   */
  activeDownloadAccess(
    customerAuthUserId: string,
    productId: string,
  ): Promise<{
    license: { licenseId: string; orderId: string; status: string; expiresAt: string | null };
    entitlement: { status: string; canDownload: boolean };
  } | null>;
  /**
   * QNT-0043 · Grants a license + entitlement from a paid/active order.
   * Idempotent per order: calling it for the same paid order twice keeps a
   * single active license and entitlement.
   */
  grantAccessFromOrder(orderId: string, rentalPeriodMs?: number): Promise<void>;
  /**
   * QNT-0043 · Product commercial state used by the endpoint (catalog state
   * is what can currently be activated in the database).
   */
  productState(productId: string): Promise<{
    status: string;
    commercialDownloadEnabled: boolean;
  } | null>;
  /** QNT-0043 · Appends an audit row for every served download. */
  recordDownloadDownloaded(
    customerAuthUserId: string,
    productId: string,
    licenseId: string | null,
    orderId: string | null,
  ): Promise<void>;
}

/**
 * Shared apply logic: idempotent by event id, transitions delegated to the
 * pure checkout state machine. An unknown order is recorded (so a replay stays
 * a no-op) but never grants anything.
 */
export async function applyEventWith(
  ledger: PaymentLedger,
  event: LedgerEvent,
): Promise<LedgerApplyResult> {
  if (await ledger.hasProcessedEvent(event.eventId)) {
    return { ok: false, reason: 'event_already_processed' };
  }
  if (!event.orderId) {
    await ledger.recordEvent(event);
    return { ok: false, reason: 'order_not_found' };
  }
  const record = await ledger.findByOrderId(event.orderId);
  if (!record) {
    await ledger.recordEvent(event);
    return { ok: false, reason: 'order_not_found' };
  }
  const next = applyStripeWebhookEvent(record, { eventId: event.eventId, type: event.type });
  await ledger.saveOrder(next.record);
  await ledger.recordEvent(event);
  // QNT-0043: every successfully applied event that settles money grants (or
  // refreshes) the matching license + entitlement.
  if (next.applied) {
    await ledger.grantAccessFromOrder(event.orderId);
  }
  return { ok: true, applied: next.applied, record: next.record, duplicate: false };
}

/** QNT-0043 · In-memory download access (license + entitlement per order). */
type DownloadAccess = {
  customerAuthUserId: string;
  productId: string;
  license: { licenseId: string; orderId: string; status: string; expiresAt: string | null };
  entitlement: { status: string; canDownload: boolean };
};

/** In-memory ledger: tests and local development only (nothing survives a restart). */
export function createMemoryLedger(): PaymentLedger {
  const orders = new Map<string, CheckoutRecord>();
  const events = new Set<string>();
  const accesses = new Map<string, DownloadAccess>();
  const licensesByOrder = new Map<string, string>();
  const downloads: { customerAuthUserId: string; productId: string; occurredAt: string }[] = [];

  const ledger: PaymentLedger = {
    kind: 'memory',
    async createOrder(draft) {
      const now = new Date().toISOString();
      const record: CheckoutRecord = {
        orderId: crypto.randomUUID(),
        customerId: draft.customerAuthUserId,
        productId: draft.productId,
        billingModel: draft.billingModel,
        amountMinor: draft.amountMinor,
        currency: draft.currency,
        status: 'pending',
        stripeSessionId: draft.stripeSessionId,
        stripeEventIds: [],
        createdAt: now,
        updatedAt: now,
      };
      orders.set(record.orderId, record);
      return record;
    },
    async findByOrderId(orderId) {
      return orders.get(orderId) ?? null;
    },
    async findBySessionId(sessionId) {
      for (const record of orders.values()) {
        if (record.stripeSessionId === sessionId) return record;
      }
      return null;
    },
    async saveOrder(record) {
      orders.set(record.orderId, record);
    },
    async listByCustomer(customerAuthUserId) {
      return [...orders.values()]
        .filter((record) => record.customerId === customerAuthUserId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async hasProcessedEvent(eventId) {
      return events.has(eventId);
    },
    async recordEvent(event) {
      events.add(event.eventId);
    },
    async applyEvent(event) {
      return applyEventWith(ledger, event);
    },

    /**
     * QNT-0043 · Latest license with an entitlement for a product and customer.
     * Used by the download endpoint: the newest access wins.
     */
    async activeDownloadAccess(customerAuthUserId: string, productId: string) {
      const latest = [...accesses.values()].reverse().find(
        (access) => access.customerAuthUserId === customerAuthUserId && access.productId === productId,
      );
      if (!latest) return null;
      return { license: latest.license, entitlement: latest.entitlement };
    },

    /**
     * QNT-0043 · Grants a license + entitlement from a paid/active order.
     * Idempotent per order: at most one license exists per order id.
     */
    async grantAccessFromOrder(orderId: string, rentalPeriodMs?: number) {
      const record = orders.get(orderId);
      const done = record && (record.status === 'paid' || record.status === 'active');
      if (!record || !done) return;
      if (licensesByOrder.has(orderId)) return;
      const now = Date.now();
      const expiresAt =
        record.billingModel === 'rental'
          ? new Date(now + (rentalPeriodMs ?? RENTAL_PERIOD_MS)).toISOString()
          : null;
      const access: DownloadAccess = {
        customerAuthUserId: record.customerId,
        productId: record.productId,
        license: { licenseId: `lic_${record.orderId}`, orderId: record.orderId, status: 'active', expiresAt },
        entitlement: { status: 'granted', canDownload: true },
      };
      accesses.set(access.license.licenseId, access);
      licensesByOrder.set(orderId, access.license.licenseId);
    },

    /** QNT-0043 · Memory mirrors the catalog state set through setMemoryProductState. */
    async productState(productId: string) {
      const state = memoryExtras.get(ledger)?.[`productState:${productId}`] as
        | { status: string; commercialDownloadEnabled: boolean }
        | undefined;
      return state ?? null;
    },

    /** QNT-0043 · Appends in-memory audit rows for every served download. */
    async recordDownloadDownloaded(customerAuthUserId: string, productId: string) {
      downloads.push({ customerAuthUserId, productId, occurredAt: new Date().toISOString() });
    },
  };

  return ledger;
}

/**
 * QNT-0043 · Mirrors the published catalog state into a memory ledger.
 *
 * Intended for development flows without a database (never production): the
 * memory ledger has no products table, so integration code sets the same
 * `status` / `commercialDownloadEnabled` the catalog advertises. Unknown
 * products keep denying by default.
 */
export function setMemoryProductState(
  ledger: PaymentLedger,
  state: { productId: string; status: string; commercialDownloadEnabled: boolean },
): void {
  const key = `productState:${state.productId}`;
  memoryExtras.set(ledger, { ...(memoryExtras.get(ledger) ?? {}), [key]: state });
}

const memoryExtras = new WeakMap<PaymentLedger, Record<string, unknown>>();

let memoryLedger: PaymentLedger | null = null;

/** Process-wide memory ledger (development/test only). */
export function getMemoryLedger(): PaymentLedger {
  if (!memoryLedger) memoryLedger = createMemoryLedger();
  return memoryLedger;
}

/**
 * Resolves the ledger for the current environment.
 *
 * `null` means "no persistence available" and callers MUST refuse to record a
 * payment: in production an unconfigured database can never grant access. The
 * Postgres implementation is imported lazily so the Neon client never enters
 * the client bundle.
 */
export async function getPaymentLedger(): Promise<PaymentLedger | null> {
  const url = typeof process === 'undefined' ? undefined : process.env.DATABASE_URL;
  if (url && url.length > 0) {
    const { createPostgresLedger } = await import('./postgres-ledger');
    return createPostgresLedger(url);
  }
  if (resolveAppEnv() === 'production') return null;
  return getMemoryLedger();
}
