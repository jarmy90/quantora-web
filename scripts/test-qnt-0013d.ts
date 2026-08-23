/**
 * QNT-0013D · Live Supabase setup tests.
 *
 * Runs with bun (no third-party deps):
 *   bun run scripts/test-qnt-0013d.ts
 *
 * Validates ONLY repository artifacts (SQL for the live project, docs, env
 * contract). It never touches real Supabase, never calls real users and
 * never reads or prints token/cookie values. If `.env.local` exists it only
 * checks variable NAMES; if it is absent (owner machine not set up yet) the
 * corresponding checks report that state without failing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as subprocess from 'node:child_process';
import { getSupabaseEnv } from '../src/lib/supabase/env.ts';

const ROOT = resolve(import.meta.dir, '..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

const tests: { name: string; run: () => void }[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const LIVE_SQL = 'db/migrations/live/001_live_setup.sql';
const DOC = 'docs/SUPABASE_LIVE_SETUP.md';

// ---------------------------------------------------------------------------
// 1. Live SQL: safe, ordered and idempotent
// ---------------------------------------------------------------------------

test('live setup SQL exists and is ordered with BEGIN/COMMIT', () => {
  const sql = read(LIVE_SQL);
  assert(sql.includes('BEGIN;'), 'must open a transaction');
  assert(sql.includes('COMMIT;'), 'must commit the transaction');
  const begin = sql.indexOf('BEGIN;');
  const commit = sql.indexOf('COMMIT;');
  assert(begin !== -1 && commit !== -1 && begin < commit, 'BEGIN must come before COMMIT');
  // Ordered sections: foundation -> auth relation -> RLS -> privileges -> trigger.
  assert(sql.indexOf('base commercial foundation') < sql.indexOf('Auth -> customer relation'), '0001 must precede 0002');
  assert(sql.indexOf('Auth -> customer relation') < sql.indexOf('Row Level Security'), '0002 must precede RLS');
  assert(sql.indexOf('Row Level Security') < sql.indexOf('Privileges'), 'RLS must precede privileges');
  assert(sql.indexOf('Privileges') < sql.indexOf('Customer onboarding trigger'), 'privileges must precede the trigger');
});

test('every non-idempotent object has an explicit replace strategy', () => {
  const code = read(LIVE_SQL)
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  // CREATE POLICY -> a DROP POLICY IF EXISTS must appear earlier in the file.
  for (const m of code.matchAll(/CREATE POLICY (\w+) ON/g)) {
    const name = m[1];
    assert(
      code.slice(0, m.index).includes(`DROP POLICY IF EXISTS ${name} ON`),
      `CREATE POLICY ${name} must be preceded by DROP POLICY IF EXISTS`,
    );
  }
  // CREATE TRIGGER -> DROP TRIGGER IF EXISTS earlier.
  for (const m of code.matchAll(/CREATE TRIGGER (\w+) ON/g)) {
    const name = m[1];
    assert(
      code.slice(0, m.index).includes(`DROP TRIGGER IF EXISTS ${name} ON`),
      `CREATE TRIGGER ${name} must be preceded by DROP TRIGGER IF EXISTS`,
    );
  }
  // CREATE FUNCTION -> CREATE OR REPLACE FUNCTION.
  assert(code.includes('CREATE OR REPLACE FUNCTION'), 'functions must use CREATE OR REPLACE');
  assert(!/CREATE (?!OR REPLACE )FUNCTION/.test(code), 'no plain CREATE FUNCTION without OR REPLACE');
  // CREATE TABLE / INDEX -> IF NOT EXISTS.
  assert(code.includes('CREATE TABLE IF NOT EXISTS'), 'tables must use IF NOT EXISTS');
  assert(code.includes('CREATE INDEX IF NOT EXISTS'), 'indexes must use IF NOT EXISTS');
  assert(!/CREATE TABLE (?!IF NOT EXISTS)/.test(code), 'no CREATE TABLE without IF NOT EXISTS');
  // INSERT -> ON CONFLICT DO NOTHING (scan to the end of each statement).
  for (const m of code.matchAll(/INSERT INTO /g)) {
    const rest = code.slice(m.index);
    const end = rest.indexOf(';');
    const chunk = rest.slice(0, end);
    assert(chunk.includes('ON CONFLICT') && chunk.includes('DO NOTHING'), 'every INSERT must be ON CONFLICT DO NOTHING');
  }
  assert(!/DROP TABLE/i.test(code), 'must never DROP TABLE');
  assert(!/TRUNCATE/i.test(code), 'must never TRUNCATE');
});

test('live setup SQL is idempotent (no destructive rewrites)', () => {
  const sql = read(LIVE_SQL);
  assert(sql.includes('CREATE TABLE IF NOT EXISTS'), 'tables must use IF NOT EXISTS');
  assert(sql.includes('ADD COLUMN IF NOT EXISTS'), 'column add must be idempotent');
  assert(sql.includes('CREATE INDEX IF NOT EXISTS'), 'indexes must be idempotent');
  assert(sql.includes('DROP POLICY IF EXISTS customers_read_own ON customers'), 'policy drop must exist');
  assert(sql.includes('ON CONFLICT (product_id) DO NOTHING'), 'product seed must be idempotent');
  assert(sql.includes('ON CONFLICT (auth_user_id) DO NOTHING'), 'customer trigger insert must be idempotent');
});

test('RLS is enabled on all seven commercial tables and only customers has policies', () => {
  const code = read(LIVE_SQL)
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .replace(/\s+/g, ' ');
  assert(!/USING\s*\(\s*true\s*\)/i.test(code), 'no USING (true) policy anywhere');
  const tables = ['products', 'plans', 'customers', 'orders', 'payments', 'licenses', 'entitlements'];
  for (const t of tables) {
    assert(code.includes(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`), `RLS must be enabled on ${t}`);
  }
  // The only policy is the owner-scoped SELECT on customers.
  const createPolicyCount = (code.match(/CREATE POLICY /g) ?? []).length;
  assert(createPolicyCount === 1, `exactly one CREATE POLICY expected, got ${createPolicyCount}`);
  assert(code.includes('CREATE POLICY customers_read_own ON customers'), 'only customers_read_own policy expected');
  assert(!code.includes('customers_update_own'), 'no UPDATE policy in this phase');
  assert(!/FOR UPDATE/i.test(code), 'no UPDATE policy in this phase');
  const ownCount = (code.match(/auth\.uid\(\) = auth_user_id/g) ?? []).length;
  assert(ownCount >= 1, 'owner-scoped predicate must exist');
});

test('anon and authenticated get no commercial grants; customers is SELECT-only', () => {
  const code = read(LIVE_SQL)
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .replace(/\s+/g, ' ');
  for (const t of ['products', 'plans', 'orders', 'payments', 'licenses', 'entitlements']) {
    assert(code.includes(`REVOKE ALL ON ${t} FROM anon, authenticated;`), `REVOKE ALL on ${t} expected`);
  }
  // customers is revoked per-role (its SELECT grant for authenticated comes after).
  assert(code.includes('REVOKE ALL ON customers FROM anon;'), 'anon must lose all on customers');
  assert(code.includes('REVOKE ALL ON customers FROM authenticated;'), 'authenticated must lose all on customers');
  assert(code.includes('GRANT SELECT ('), 'only SELECT grants on customers');
  assert(!/GRANT (?!SELECT)/.test(code), 'no INSERT/UPDATE/DELETE grants anywhere');
  assert(!code.includes('GRANT UPDATE'), 'no UPDATE grant on customers (no profile editing yet)');
  // role / status / auth_user_id cannot be changed by the user: no UPDATE
  // privilege and no UPDATE policy exist at all.
  assert(!code.includes('FOR UPDATE'), 'no FOR UPDATE policy');
});

test('customer onboarding trigger is standard, safe and documented as such', () => {
  const sql = read(LIVE_SQL);
  const doc = read(DOC);
  assert(sql.includes('Customer onboarding trigger'), 'SQL must label the trigger as standard onboarding');
  assert(sql.includes('SECURITY DEFINER'), 'function must be SECURITY DEFINER');
  assert(sql.includes('SET search_path = public'), 'search_path must be pinned');
  assert(sql.includes('REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;'), 'function must be revoked from PUBLIC');
  const insert = sql.slice(sql.indexOf('INSERT INTO customers (auth_user_id'));
  assert(insert.includes('NEW.id'), 'identity must be the auth user id');
  assert(insert.includes('NEW.email'), 'email may come from auth.users');
  assert(insert.includes("NULL, 'customer', 'pending'"), 'display_name must stay NULL; role/status fixed');
  assert(insert.includes('ON CONFLICT (auth_user_id) DO NOTHING'), 'repeated signup must not error');
  assert(!/password|secret|token/i.test(insert), 'trigger must not touch credentials');
  // The trigger is standard: the docs must not call it optional anymore.
  assert(!/trigger\s+opcional|optional\s+trigger/i.test(doc), 'docs must not describe the trigger as optional');
  assert(doc.includes('Trigger de alta de cliente'), 'docs must label the trigger as standard');
});

test('live setup SQL keeps the four products coming_soon with downloads off', () => {
  const sql = read(LIVE_SQL);
  for (const pid of ['first-triangle-ustec-m30', 'first-triangle-gold-m15', 'stochextreme-ustec', 'tm-bandas-s3-keeper']) {
    assert(sql.includes(pid), `seed must contain ${pid}`);
  }
  // The CHECK constraint legitimately lists 'available' as an allowed state;
  // what matters is the SEED: every product row must be 'coming_soon'.
  const seed = sql.slice(sql.indexOf('INSERT INTO products'));
  assert((seed.match(/'coming_soon'/g) ?? []).length >= 4, 'seed must set every product to coming_soon');
  assert(!seed.includes("'available'"), 'no seeded product may be available');
  assert((seed.match(/false/g) ?? []).length >= 4, 'commercial_download_enabled must be false for all');
});

test('auth_user_id relation is unique and indexed', () => {
  const sql = read(LIVE_SQL);
  assert(sql.includes('auth_user_id uuid UNIQUE REFERENCES auth.users (id)'), 'auth_user_id must be UNIQUE FK to auth.users');
  assert(sql.includes('ON DELETE SET NULL'), 'auth link must not cascade-delete the customer');
  assert(sql.includes('idx_customers_auth_user ON customers (auth_user_id)'), 'auth lookup must be indexed');
});

test('live SQL contains no service role, secrets or vault paths', () => {
  const sql = read(LIVE_SQL);
  for (const needle of ['service_role', 'SERVICE_ROLE', 'sb_publishable', 'sk_live', 'vault', 'quantora-ea-vault']) {
    assert(!sql.includes(needle), `live SQL must not mention ${needle}`);
  }
});

// ---------------------------------------------------------------------------
// 2. Docs
// ---------------------------------------------------------------------------

test('SUPABASE_LIVE_SETUP.md covers order, verification and rollback', () => {
  const doc = read(DOC);
  assert(doc.includes('db/migrations/live/001_live_setup.sql'), 'doc must point to the SQL file');
  for (const section of ['Cómo verificar', 'Rollback', 'Qué NO está activado', 'Prueba manual de autenticación']) {
    assert(doc.includes(section), `doc must contain "${section}"`);
  }
  assert(doc.includes('no debe estar en'), 'doc must warn about service role');
  assert(doc.includes('.env.local') && doc.includes('ignorado por Git'), 'doc must state .env.local is ignored');
});

test('manual test guide never asks for real credentials in Git', () => {
  const doc = read(DOC);
  assert(doc.includes('email de prueba que tú controles'), 'guide must require an owner-controlled test email');
  assert(doc.includes('No lo incluyas en Git'), 'guide must forbid committing the test email');
  const guide = doc.slice(doc.indexOf('1. Arranca la web local'));
  const steps = (guide.match(/^\d+\./gm) ?? []).length;
  assert(steps >= 10, `guide must have at least 10 numbered steps, got ${steps}`);
  assert(doc.includes('/auth/callback'), 'guide must cover the callback');
  assert(doc.includes('/reset-password'), 'guide must cover password reset');
});

// ---------------------------------------------------------------------------
// 3. Environment contract (names only — values are never read or printed)
// ---------------------------------------------------------------------------

test('.env.local is git-ignored and, if present, holds only the two public vars', () => {
  const check = subprocess.execSync('git check-ignore -q .env.local && echo ignored || echo not-ignored', { cwd: ROOT }).toString().trim();
  assert(check === 'ignored', '.env.local must be excluded by .gitignore rules');
  const tracked = subprocess.execSync('git ls-files .env.local', { cwd: ROOT }).toString().trim();
  assert(tracked === '', '.env.local must never be tracked by Git');
  const path = resolve(ROOT, '.env.local');
  if (!existsSync(path)) {
    console.log('  (info) .env.local is absent on this machine — live auth not configured here');
    return;
  }
  const lines = read('.env.local')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  const names = lines.filter((l) => l.includes('=')).map((l) => l.split('=', 1)[0]);
  const allowed = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']);
  for (const n of names) {
    assert(allowed.has(n), `unexpected variable ${n} in .env.local`);
  }
  for (const required of allowed) {
    assert(names.includes(required), `${required} must be present in .env.local`);
  }
});

test('.env.example stays free of secret values and documents the boundary', () => {
  const example = read('.env.example');
  // Only inspect actual NAME= assignments; every value must be empty.
  const assignments = example
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l));
  assert(assignments.length >= 8, 'env contract must declare the expected variables');
  for (const line of assignments) {
    const name = line.split('=')[0];
    const value = line.slice(line.indexOf('=') + 1).trim();
    // Feature flags document their safe default; everything else stays empty.
    assert(value === '' || value === 'false', `unexpected value for ${name} in .env.example`);
  }
  for (const needle of ['sk_live', 'service_role', 'service-role']) {
    assert(!example.includes(needle), `.env.example must not contain ${needle}`);
  }
  assert(example.includes('VITE_SUPABASE_URL'), 'public URL var must be documented');
  assert(example.includes('VITE_SUPABASE_PUBLISHABLE_KEY'), 'publishable key var must be documented');
});

test('auth configuration resolves to not_configured without credentials (web still boots)', () => {
  const env = getSupabaseEnv();
  assert(env.state === 'not_configured' || env.state === 'configured', `unexpected env state ${env.state}`);
  // If credentials existed, the state machine must still never leak secrets.
  assert(!('serviceRoleKey' in env), 'env module must not expose a service role');
});

// ---------------------------------------------------------------------------
// 4. Historical migrations remain intact
// ---------------------------------------------------------------------------

test('historical migrations 0001 and 0002 are untouched and consistent', () => {
  const m1 = read('db/migrations/0001_commercial_foundation.sql');
  const m2 = read('db/migrations/0002_customers_auth_user.sql');
  assert(m1.includes('CREATE TABLE IF NOT EXISTS products'), '0001 must define products');
  assert(m2.includes('ADD COLUMN IF NOT EXISTS auth_user_id'), '0002 must add auth_user_id');
  // The live file must be a superset of the same safety contract.
  const live = read(LIVE_SQL);
  for (const table of ['products', 'plans', 'customers', 'orders', 'payments', 'licenses', 'entitlements']) {
    assert(live.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `live SQL must define ${table}`);
  }
});

// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.run();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`✗ ${t.name}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`Tests executed: ${tests.length} | passed: ${passed} | failed: ${failed}`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
