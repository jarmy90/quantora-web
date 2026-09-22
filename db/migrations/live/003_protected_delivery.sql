-- ============================================================================
-- QNT-0043 · PROTECTED EA DELIVERY (run once, in order, in the SQL Editor)
-- ============================================================================
-- Paste this whole file into Supabase SQL Editor after 002_stripe_webhook.sql.
-- It is idempotent: safe to re-run and it never inserts customers, orders,
-- payments, licenses, files or downloads.
--
-- What it adds:
--   1. `product_files` — server-only registry of which private vault object
--      serves each product (path, hash, size). The EA binaries themselves live
--      in the private Storage bucket, never in Git and never in this table.
--   2. `download_events` — audit of every served download (who, what, when,
--      under which license and order).
--   3. RLS closed and privileges revoked on both tables, consistent with
--      001/002. Access happens only through the service-role server path.
--
-- It activates nothing: flipping a product to `available` with
-- `commercialDownloadEnabled=true` stays a separate commercial decision
-- (the delivery endpoint denies every request until then, by design).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS product_files (
    product_id   text PRIMARY KEY,
    path         text NOT NULL,
    sha256       text NOT NULL CHECK (sha256 ~ '^[0-9a-fA-F]{64}$'),
    bytes        bigint NOT NULL CHECK (bytes > 0),
    uploaded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS download_events (
    download_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   uuid REFERENCES customers (customer_id) ON DELETE SET NULL,
    product_id    text NOT NULL,
    license_id    uuid REFERENCES licenses (license_id) ON DELETE SET NULL,
    order_id      uuid REFERENCES orders (order_id) ON DELETE SET NULL,
    occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_download_events_customer ON download_events (customer_id);
CREATE INDEX IF NOT EXISTS idx_download_events_product ON download_events (product_id);

ALTER TABLE product_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON product_files FROM anon, authenticated;
REVOKE ALL ON download_events FROM anon, authenticated;

COMMIT;
