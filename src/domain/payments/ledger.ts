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
 */
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
  return { ok: true, applied: next.applied, record: next.record, duplicate: false };
}

/** In-memory ledger: tests and local development only (nothing survives a restart). */
export function createMemoryLedger(): PaymentLedger {
  const orders = new Map<string, CheckoutRecord>();
  const events = new Set<string>();

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
  };

  return ledger;
}

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
