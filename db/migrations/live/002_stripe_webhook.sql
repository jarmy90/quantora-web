-- ============================================================================
-- QNT-0042 · STRIPE WEBHOOK PERSISTENCE (run once, in order, in the SQL Editor)
-- ============================================================================
-- Paste this whole file into Supabase SQL Editor (Dashboard → SQL → New query)
-- and run it after 001_live_setup.sql. It is idempotent: safe to re-run and it
-- never inserts orders, payments, licenses or downloads.
--
-- What it adds:
--   1. `stripe_events` — the processed-event ledger (idempotency by event id).
--   2. `orders` columns needed to reconcile a Checkout Session with an order.
--   3. A unique key so a payment row can be upserted per (order, provider).
--   4. The active plans (300 EUR one-time purchase / 10 EUR per month rental)
--      for the three published products, matching the versioned catalog.
--   5. RLS closed and privileges revoked on the new table.
--
-- Prices are the owner's fixed decision (src/domain/payments/prices.ts); this
-- seed never invents an amount and never enables payments: the feature flag
-- stays false in production (PAYMENTS_ENABLED=false).
-- ============================================================================

BEGIN;

-- 1) Processed Stripe events (idempotency; a replay is a no-op).
CREATE TABLE IF NOT EXISTS stripe_events (
    event_id     text PRIMARY KEY,
    event_type   text NOT NULL,
    order_id     uuid REFERENCES orders (order_id) ON DELETE SET NULL,
    applied      boolean NOT NULL DEFAULT false,
    received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_order ON stripe_events (order_id);

-- 2) Order reconciliation with the payment provider (server-only fields).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_model text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_reference text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_billing_model'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT orders_billing_model
            CHECK (billing_model IS NULL OR billing_model IN ('rental','purchase'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_session
    ON orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- 3) One payment row per (order, provider): the webhook upserts on this key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_provider
    ON payments (order_id, provider) WHERE provider IS NOT NULL;

-- 4) Active plans for the three published products (idempotent).
--    purchase / one_time = 30000 minor units (300 EUR)
--    rental   / monthly  = 1000  minor units (10 EUR per month)
INSERT INTO plans (product_ref, billing_model, billing_interval, status, price_amount_minor, currency)
SELECT p.id, v.billing_model, v.billing_interval, 'active', v.price_amount_minor, 'EUR'
FROM (
    VALUES
        ('purchase', 'one_time', 30000),
        ('rental',   'monthly',  1000)
) AS v (billing_model, billing_interval, price_amount_minor)
CROSS JOIN products p
WHERE p.product_id IN ('first-triangle-ustec-m30', 'first-triangle-gold-m15', 'stochextreme-ustec')
  AND NOT EXISTS (
      SELECT 1 FROM plans pl
      WHERE pl.product_ref = p.id AND pl.billing_model = v.billing_model
  );

-- 5) RLS closed by default and privileges revoked, consistent with 001.
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON stripe_events FROM anon, authenticated;

COMMIT;
