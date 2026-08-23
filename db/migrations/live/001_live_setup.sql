-- ============================================================================
-- QNT-0013D · LIVE SUPABASE SETUP (run once, in order, in the SQL Editor)
-- ============================================================================
-- Paste this whole file into Supabase SQL Editor (Dashboard → SQL → New query)
-- and run it. It is idempotent: safe to re-run; it never inserts users,
-- prices, orders, payments, licenses or downloads.
--
-- It combines, in order:
--   1. base commercial foundation (QNT-0012, migration 0001)
--   2. auth -> customer relation (QNT-0013, migration 0002)
--   3. minimal RLS for customers
--   4. OPTIONAL trigger: auto-create a customer row on sign-up
--
-- Expected result: a green "Success" banner and a fresh `customers` row the
-- first time a test user confirms their email. See
-- docs/SUPABASE_LIVE_SETUP.md for verification and rollback.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Base commercial foundation (QNT-0012, migration 0001)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id                   text NOT NULL UNIQUE,
    strategy_id                  text NOT NULL UNIQUE,
    display_name                 text NOT NULL,
    status                       text NOT NULL DEFAULT 'coming_soon'
                                 CHECK (status IN ('not_listed','coming_soon','available','paused','deprecated')),
    delivery_format              text NOT NULL DEFAULT 'ex5'
                                 CHECK (delivery_format IN ('ex5')),
    commercial_download_enabled  boolean NOT NULL DEFAULT false,
    created_at                   timestamptz NOT NULL DEFAULT now(),
    updated_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);

CREATE TABLE IF NOT EXISTS plans (
    plan_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_ref        uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    billing_model      text NOT NULL CHECK (billing_model IN ('rental','purchase')),
    billing_interval   text NOT NULL
                       CHECK (billing_interval IN ('monthly','quarterly','annual','one_time')),
    status             text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','inactive','active','retired')),
    price_amount_minor integer,
    currency           text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT plans_billing_combination CHECK (
        (billing_model = 'rental'   AND billing_interval IN ('monthly','quarterly','annual'))
        OR (billing_model = 'purchase' AND billing_interval = 'one_time')
    ),
    CONSTRAINT plans_price_pair CHECK (
        (price_amount_minor IS NULL AND currency IS NULL)
        OR (price_amount_minor IS NOT NULL AND currency IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_plans_product ON plans (product_ref);
CREATE INDEX IF NOT EXISTS idx_plans_status  ON plans (status);

CREATE TABLE IF NOT EXISTS customers (
    customer_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text UNIQUE,
    display_name  text,
    role          text NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer','creator','admin')),
    status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','active','suspended','closed')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    order_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   uuid NOT NULL REFERENCES customers (customer_id),
    product_ref   uuid NOT NULL REFERENCES products (id),
    plan_id       uuid NOT NULL REFERENCES plans (plan_id),
    status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','pending_payment','paid','cancelled','expired','refunded','failed')),
    amount_minor  integer,
    currency      text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orders_price_pair CHECK (
        (amount_minor IS NULL AND currency IS NULL)
        OR (amount_minor IS NOT NULL AND currency IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders (status);

CREATE TABLE IF NOT EXISTS payments (
    payment_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid REFERENCES orders (order_id),
    provider            text,
    provider_reference  text,
    status              text NOT NULL DEFAULT 'not_started'
                        CHECK (status IN ('not_started','pending','requires_action','succeeded',
                                          'failed','cancelled','refunded','partially_refunded')),
    amount_minor        integer NOT NULL,
    currency            text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

CREATE TABLE IF NOT EXISTS licenses (
    license_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      uuid NOT NULL REFERENCES customers (customer_id),
    product_ref      uuid NOT NULL REFERENCES products (id),
    order_id         uuid NOT NULL REFERENCES orders (order_id),
    status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','active','grace_period','expired','revoked')),
    starts_at        timestamptz,
    expires_at       timestamptz,
    max_activations  integer,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licenses_customer_product ON licenses (customer_id, product_ref);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses (status);

CREATE TABLE IF NOT EXISTS entitlements (
    entitlement_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id                uuid NOT NULL REFERENCES customers (customer_id),
    product_ref                uuid NOT NULL REFERENCES products (id),
    license_id                 uuid NOT NULL REFERENCES licenses (license_id),
    status                     text NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','granted','suspended','expired','revoked')),
    can_download               boolean NOT NULL DEFAULT false,
    can_view_customer_content  boolean NOT NULL DEFAULT false,
    created_at                 timestamptz NOT NULL DEFAULT now(),
    updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entitlements_customer_product ON entitlements (customer_id, product_ref);
CREATE INDEX IF NOT EXISTS idx_entitlements_status ON entitlements (status);

-- Declarative seed: the four known products only (coming_soon, no download,
-- no price). Idempotent on the stable product_id.
INSERT INTO products (product_id, strategy_id, display_name, status, delivery_format, commercial_download_enabled)
VALUES
    ('first-triangle-ustec-m30',  'first-triangle-adaptive',      'First Triangle Adaptive',      'coming_soon', 'ex5', false),
    ('first-triangle-gold-m15',   'first-triangle-gold-adaptive', 'First Triangle Gold Adaptive', 'coming_soon', 'ex5', false),
    ('stochextreme-ustec',        'stochextreme-adaptive',        'StochExtreme Adaptive',        'coming_soon', 'ex5', false),
    ('tm-bandas-s3-keeper',       'tm-bandas-s3',                 'TM Bandas S3',                 'coming_soon', 'ex5', false)
ON CONFLICT (product_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) Auth -> customer relation (QNT-0013, migration 0002)
-- ---------------------------------------------------------------------------
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_auth_user ON customers (auth_user_id);

-- ---------------------------------------------------------------------------
-- 3) Minimal Row Level Security for customers
-- ---------------------------------------------------------------------------
-- A signed-in user may read and update ONLY their own row. No USING (true),
-- no anonymous access to personal data, nothing exposed for orders,
-- licenses, entitlements, plans or products.
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_read_own ON customers
    FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY customers_update_own ON customers
    FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

-- ---------------------------------------------------------------------------
-- 4) OPTIONAL: auto-create a customer row when a user signs up
-- ---------------------------------------------------------------------------
-- Only the auth user id is used as the identity. email/display_name respect
-- the contract's nullability (email comes from auth.users and may be NULL for
-- non-email signups; display_name stays NULL until the profile mechanism
-- lands). Idempotent: a repeated sign-up event never fails (ON CONFLICT DO
-- NOTHING on auth_user_id).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO customers (auth_user_id, email, display_name, role, status)
    VALUES (NEW.id, NEW.email, NULL, 'customer', 'pending')
    ON CONFLICT (auth_user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

COMMIT;
