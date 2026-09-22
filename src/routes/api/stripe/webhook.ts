/**
 * QNT-0042 · Stripe webhook — `POST /api/stripe/webhook`.
 *
 * Server route (never rendered). Contract:
 *   1. verify the `Stripe-Signature` header over the RAW body (no JSON parsing
 *      before verification), with the 300 s replay tolerance;
 *   2. only then parse the event and resolve the order from the metadata;
 *   3. apply the event through the ledger, which is idempotent by event id;
 *   4. fail closed: without a webhook secret or without persistence (production
 *      with no database) it responds 5xx and never grants anything.
 *
 * Responses: 400 invalid signature/payload, 503 not configured, 200 otherwise
 * (including duplicates and unknown orders, so Stripe never retries a no-op).
 */
import { createFileRoute } from '@tanstack/react-router';
import { getPaymentLedger } from '../../../domain/payments/ledger';
import { verifyStripeSignature } from '../../../domain/payments/webhook';

type StripeEventPayload = {
  id?: unknown;
  type?: unknown;
  data?: {
    object?: {
      id?: unknown;
      client_reference_id?: unknown;
      metadata?: Record<string, unknown>;
    };
  };
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = typeof process === 'undefined' ? undefined : process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return json({ ok: false, error: 'webhook_not_configured' }, 503);

        const rawBody = await request.text();
        const signature = request.headers.get('stripe-signature');
        const check = await verifyStripeSignature(rawBody, signature, secret);
        if (!check.ok) return json({ ok: false, error: 'invalid_signature' }, 400);

        let event: StripeEventPayload;
        try {
          event = JSON.parse(rawBody) as StripeEventPayload;
        } catch {
          return json({ ok: false, error: 'invalid_payload' }, 400);
        }

        const eventId = typeof event.id === 'string' ? event.id : '';
        const eventType = typeof event.type === 'string' ? event.type : '';
        if (!eventId || !eventType) return json({ ok: false, error: 'invalid_event' }, 400);

        const object = event.data?.object;
        const metadata = object?.metadata ?? {};
        const orderId =
          typeof metadata['order_id'] === 'string'
            ? (metadata['order_id'] as string)
            : typeof object?.client_reference_id === 'string'
              ? object.client_reference_id
              : null;

        const ledger = await getPaymentLedger();
        if (!ledger) return json({ ok: false, error: 'ledger_not_configured' }, 503);

        const result = await ledger.applyEvent({
          eventId,
          type: eventType,
          orderId,
          providerReference: typeof object?.id === 'string' ? object.id : null,
        });

        if (!result.ok) {
          // Recorded as processed, but nothing changed: never grant access here.
          return json({ ok: true, applied: false, reason: result.reason }, 200);
        }
        return json({ ok: true, applied: result.applied, orderStatus: result.record.status }, 200);
      },
    },
  },
});
