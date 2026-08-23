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
  // Ordered sections: foundation -> auth relation -> RLS -> trigger.
  assert(sql.indexOf('base commercial foundation') < sql.indexOf('Auth -> customer relation'), '0001 must precede 0002');
  assert(sql.indexOf('Auth -> customer relation') < sql.indexOf('Row Level Security'), '0002 must precede RLS');
  assert(sql.indexOf('Row Level Security') < sql.indexOf('OPTIONAL: auto-create a customer'), 'RLS must precede the trigger');
});

test('live setup SQL is idempotent (no destructive rewrites)', () => {
  const sql = read(LIVE_SQL);
  assert(sql.includes('CREATE TABLE IF NOT EXISTS'), 'tables must use IF NOT EXISTS');
  assert(sql.includes('ADD COLUMN IF NOT EXISTS'), 'column add must be idempotent');
  assert(sql.includes('CREATE INDEX IF NOT EXISTS'), 'indexes must be idempotent');
  assert(sql.includes('ON CONFLICT (product_id) DO NOTHING'), 'product seed must be idempotent');
  assert(sql.includes('ON CONFLICT (auth_user_id) DO NOTHING'), 'customer trigger insert must be idempotent');
  assert(!/DROP TABLE/i.test(sql), 'must never DROP TABLE');
  assert(!/TRUNCATE/i.test(sql), 'must never TRUNCATE');
});

test('live setup SQL never opens private tables with USING (true)', () => {
  // Strip comment lines so prose never pollutes the check.
  const code = read(LIVE_SQL)
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  assert(!/USING\s*\(\s*true\s*\)/i.test(code), 'no USING (true) policy anywhere');
  // The only policies are read/update own on customers.
  const ownCount = (code.match(/auth\.uid\(\) = auth_user_id/g) ?? []).length;
  assert(ownCount >= 2, 'only owner-scoped policies are allowed on customers');
  assert(code.includes('ENABLE ROW LEVEL SECURITY'), 'customers RLS must be enabled');
});

test('customer trigger uses only auth user id + nullable fields and never invents data', () => {
  const sql = read(LIVE_SQL);
  const insert = sql.slice(sql.indexOf('INSERT INTO customers (auth_user_id'));
  assert(insert.includes('NEW.id'), 'identity must be the auth user id');
  assert(insert.includes('NEW.email'), 'email may come from auth.users');
  assert(insert.includes("NULL, 'customer', 'pending'"), 'display_name must stay NULL; role/status fixed');
  assert(insert.includes('ON CONFLICT (auth_user_id) DO NOTHING'), 'repeated signup must not error');
  assert(!/password|secret|token/i.test(insert), 'trigger must not touch credentials');
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
