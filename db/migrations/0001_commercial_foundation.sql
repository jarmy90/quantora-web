-- ============================================================================
-- QNT-0012 · Commercial foundation (migration 0001)
--
-- Preparatory schema for the future commercial and user system. Nothing here
-- activates checkout, payments, licenses or downloads. This migration is
-- intentionally declarative: it seeds ONLY the four known products (all
-- coming_soon, download disabled, no price). It inserts NO customers, orders,
-- payments, licenses or entitlements.
--
-- Prices are stored in integer minor units; currency is nullable while plans
-- remain draft. No passwords, credentials or personal data are stored.
--
-- Identity contract (see docs/COMMERCIAL_ARCHITECTURE.md):
--   id           = internal database identifier (uuid)
--   product_id   = stable, public commercial identifier (text, e.g.
--                  first-triangle-ustec-m30)
--   strategy_id  = public strategy identifier (e.g. first-triangle-adaptive)
-- The internal FK columns (product_ref) reference products.id; the stable
-- product_id is never used as a foreign key.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Products (commercial EA attached to a public strategy)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id                   text NOT NULL UNIQUE,   -- stable public id, e.g. first-triangle-ustec-m30
    strategy_id                  text NOT NULL UNIQUE,   -- e.g. first-triangle-adaptive
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

-- ---------------------------------------------------------------------------
-- Plans (rental / purchase modalities; draft with null prices until priced)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
    plan_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_ref        uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    billing_model      text NOT NULL CHECK (billing_model IN ('rental','purchase')),
    billing_interval   text NOT NULL
                       CHECK (billing_interval IN ('monthly','quarterly','annual','one_time')),
    status             text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','inactive','active','retired')),
    price_amount_minor integer,                            -- NULL while draft; never treated as zero
    currency           text,                               -- ISO 4217; NULL while draft
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    -- A rental plan recurs on a calendar interval; a purchase is a one-time
    -- transaction. Incompatible combinations are rejected at the schema level.
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

-- ---------------------------------------------------------------------------
-- Customers (future shape; no passwords, no credentials).
-- email / display_name are nullable until QNT-0013 chooses the identity
-- mechanism and decides which fields are mandatory.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    customer_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text UNIQUE,                             -- collected only when auth lands
    display_name  text,
    role          text NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer','creator','admin')),
    status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','active','suspended','closed')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Orders (paid can only ever be set server-side)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Payments (provider-agnostic; provider_reference never exposed publicly)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Licenses (active requires a paid order; dates nullable while pending)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS licenses (
    license_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      uuid NOT NULL REFERENCES customers (customer_id),
    product_ref      uuid NOT NULL REFERENCES products (id),
    order_id         uuid NOT NULL REFERENCES orders (order_id),
    status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','active','grace_period','expired','revoked')),
    starts_at        timestamptz,
    expires_at       timestamptz,
    max_activations  integer,                              -- never invented
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licenses_customer_product ON licenses (customer_id, product_ref);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses (status);

-- ---------------------------------------------------------------------------
-- Entitlements (effective access; download gated by every condition)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Declarative seed: the four known products only (coming_soon, no download,
-- no price). Reproducible — idempotent on the stable product_id.
-- ---------------------------------------------------------------------------
INSERT INTO products (product_id, strategy_id, display_name, status, delivery_format, commercial_download_enabled)
VALUES
    ('first-triangle-ustec-m30',  'first-triangle-adaptive',      'First Triangle Adaptive',      'coming_soon', 'ex5', false),
    ('first-triangle-gold-m15',   'first-triangle-gold-adaptive', 'First Triangle Gold Adaptive', 'coming_soon', 'ex5', false),
    ('stochextreme-ustec',        'stochextreme-adaptive',        'StochExtreme Adaptive',        'coming_soon', 'ex5', false),
    ('tm-bandas-s3-keeper',       'tm-bandas-s3',                 'TM Bandas S3',                 'coming_soon', 'ex5', false)
ON CONFLICT (product_id) DO NOTHING;
