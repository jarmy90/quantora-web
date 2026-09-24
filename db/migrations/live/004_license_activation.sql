-- ============================================================================
-- QNT-0045 · ONLINE LICENSE ACTIVATION (run once, after 003)
-- ============================================================================
-- Idempotent. Adds what the EA needs to validate itself against the web:
--
--   license_key        the key shown to the customer (unique, opaque)
--   bound_account      the FIRST MT5 account that used it (anti-sharing)
--   activations        how many distinct accounts consumed it
--   max_activations    default 1 (one account per licence)
--   last_seen_at       last successful online validation (telemetry)
--
-- It activates nothing and issues no keys: keys are created when a paid order
-- is settled (webhook) and the binding happens on first EA validation.
-- ============================================================================

BEGIN;

ALTER TABLE licenses ADD COLUMN IF NOT EXISTS license_key     text;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS bound_account   bigint;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS activations     integer NOT NULL DEFAULT 0;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS max_activations integer NOT NULL DEFAULT 1;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS last_seen_at    timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_key ON licenses (license_key)
    WHERE license_key IS NOT NULL;

-- One binding per account per product: the same account cannot claim two
-- different licences of the same product (prevents key hoarding).
CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_bound_account
    ON licenses (product_ref, bound_account)
    WHERE bound_account IS NOT NULL;

COMMIT;
