-- ============================================================================
-- QNT-0013 · Auth → customer relation (migration 0002)
--
-- Supabase Auth manages identities in its own schema (auth.users, uuid PK).
-- The commercial `customers` table keeps its own internal customer_id uuid
-- and now carries an explicit, unique reference to the auth user:
--
--   customers.auth_user_id uuid UNIQUE REFERENCES auth.users(id)
--
-- This is NOT the same field as customer_id: customer_id is the internal
-- commercial identifier, auth_user_id is the Supabase identity. The two are
-- linked 1:1 so a future order/license always resolves to the same person
-- whether reached through auth or through the commercial domain.
--
-- Not executed anywhere yet — this is a preparatory migration for the live
-- project (QNT-0013 configuration step).
--
-- Reversible: DROP COLUMN IF EXISTS auth_user_id; DROP POLICY IF EXISTS ...;
-- ============================================================================

-- Link the future Supabase identity (auth.users) to the commercial customer.
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL;

-- Lookups by auth identity must stay indexed.
CREATE INDEX IF NOT EXISTS idx_customers_auth_user ON customers (auth_user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security (preparatory).
-- Enabled only when the live project exists; policies stay MINIMAL and are
-- intentionally restrictive. Nothing here grants broad anonymous access.
-- ---------------------------------------------------------------------------
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
--
-- -- A signed-in user may read their own customer row only.
-- CREATE POLICY customers_read_own ON customers
--     FOR SELECT
--     USING (auth.uid() = auth_user_id);
--
-- -- Profile updates are limited to the owner's non-privileged columns.
-- CREATE POLICY customers_update_own ON customers
--     FOR UPDATE
--     USING (auth.uid() = auth_user_id)
--     WITH CHECK (auth.uid() = auth_user_id);

-- Future note (QNT-0017): when protected delivery exists, download checks
-- must run server-side against the entitlement table — never from the
-- browser — and service-role access is required for anything beyond the
-- owner's own rows.
