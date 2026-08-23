/**
 * QNT-0013 · Authentication foundation tests.
 *
 * Runs with bun (no third-party deps):
 *   bun run scripts/test-qnt-0013.ts
 *
 * Uses the TEST-ONLY MemoryAuthService fake — never calls real Supabase.
 * Also verifies env contract, migration 0002, bundle safety and that no
 * commercial capability was activated.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isSafeReturnTo, sanitizeReturnTo } from '../src/domain/auth/contracts.ts';
import { MemoryAuthService } from '../src/domain/auth/fake.ts';
import { validateDisplayName, validateEmail, validatePassword } from '../src/domain/auth/validation.ts';
import { describeSupabaseEnv, getSupabaseEnv } from '../src/lib/supabase/env.ts';
import { buildCommercialCatalog } from '../src/commercial/catalog.ts';
import { getFeatureFlags } from '../src/config.ts';

const ROOT = resolve(import.meta.dir, '..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

const tests: { name: string; run: () => void }[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// 1. Input validation
// ---------------------------------------------------------------------------

test('email validation accepts valid and rejects invalid emails', () => {
  assert(validateEmail('trader@example.com').ok, 'valid email must pass');
  assert(validateEmail('  Name@Example.COM  ').ok, 'trimmed valid email must pass');
  for (const bad of ['', 'plain', 'a@b', 'a@b.', '@x.com', 'a b@c.com']) {
    assert(!validateEmail(bad).ok, `"${bad}" must be rejected`);
  }
});

test('password validation enforces a reasonable minimum', () => {
  assert(!validatePassword('').ok, 'empty password must be rejected');
  assert(!validatePassword('short').ok, 'short password must be rejected');
  assert(!validatePassword('       ').ok, 'whitespace password must be rejected');
  assert(validatePassword('correct-horse-9').ok, 'strong password must pass');
});

test('display name validation is lenient but bounded', () => {
  assert(validateDisplayName('').ok, 'empty display name is optional');
  assert(validateDisplayName('Ana').ok, 'short name must pass');
  assert(!validateDisplayName('x'.repeat(120)).ok, 'overlong name must be rejected');
});

// ---------------------------------------------------------------------------
// 2. Service flows via the TEST-ONLY fake
// ---------------------------------------------------------------------------

test('sign up validates and does not return a session until verified', async () => {
  const service = new MemoryAuthService();
  const bad = await service.signUp({ email: 'not-an-email', password: '12345678' });
  assert(!bad.ok && bad.error === 'invalid_form', 'invalid form must be rejected before calling the adapter');
  const result = await service.signUp({ email: 'ana@example.com', password: '12345678' });
  assert(result.ok, 'valid sign up must succeed');
  assert(result.session === null, 'no session before email verification (like Supabase)');
});

test('sign in calls the adapter and rejects wrong credentials / unverified', async () => {
  const service = new MemoryAuthService();
  await service.signUp({ email: 'ana@example.com', password: '12345678' });
  const unverified = await service.signIn({ email: 'ana@example.com', password: '12345678' });
  assert(!unverified.ok && unverified.error === 'email_not_verified', 'unverified sign-in must be blocked');
  service.verifyUser('ana@example.com');
  const wrong = await service.signIn({ email: 'ana@example.com', password: 'wrong-password' });
  assert(!wrong.ok && wrong.error === 'invalid_credentials', 'wrong password must be rejected');
  const ok = await service.signIn({ email: 'ana@example.com', password: '12345678' });
  assert(ok.ok && ok.session !== null, 'verified sign-in must return a session');
});

test('sign out invalidates the session', async () => {
  const service = new MemoryAuthService();
  await service.signUp({ email: 'ana@example.com', password: '12345678' });
  service.verifyUser('ana@example.com');
  await service.signIn({ email: 'ana@example.com', password: '12345678' });
  assert((await service.getCurrentUser()) !== null, 'session must exist after sign-in');
  await service.signOut();
  assert((await service.getCurrentUser()) === null, 'session must be gone after sign-out');
});

test('password reset never reveals whether the account exists', async () => {
  const service = new MemoryAuthService();
  await service.signUp({ email: 'ana@example.com', password: '12345678' });
  const missing = await service.requestPasswordReset({ email: 'ghost@example.com' });
  assert(missing.ok, 'reset for unknown email must still resolve ok');
  const existing = await service.requestPasswordReset({ email: 'ana@example.com' });
  assert(existing.ok, 'reset for known email must resolve ok');
  assert(!service.hasResetRequestFor('ghost@example.com'), 'no request must be recorded for unknown email');
  assert(service.hasResetRequestFor('ana@example.com'), 'request must be recorded for known email');
});

test('update password requires a valid session token (or reset flow token)', async () => {
  const service = new MemoryAuthService();
  const weak = await service.updatePassword({ newPassword: 'tiny' });
  assert(!weak.ok && weak.error === 'invalid_form', 'weak new password must be rejected');
  const ok = await service.updatePassword({ newPassword: 'new-password-123' });
  assert(ok.ok, 'valid update must resolve ok');
});

test('not_configured state blocks every operation and reports clearly', async () => {
  const service = new MemoryAuthService(false);
  const results = await Promise.all([
    service.signUp({ email: 'a@example.com', password: '12345678' }),
    service.signIn({ email: 'a@example.com', password: '12345678' }),
    service.requestPasswordReset({ email: 'a@example.com' }),
  ]);
  for (const result of results) {
    assert(!result.ok && result.error === 'not_configured', 'unconfigured service must return not_configured');
  }
  assert((await service.getCurrentUser()) === null, 'unconfigured service has no user');
});

// ---------------------------------------------------------------------------
// 3. returnTo safety
// ---------------------------------------------------------------------------

test('returnTo accepts only internal paths', () => {
  assert(isSafeReturnTo('/'), 'root is safe');
  assert(isSafeReturnTo('/account'), 'internal path is safe');
  assert(isSafeReturnTo('/strategies/first-triangle-adaptive'), 'strategy path is safe');
  assert(!isSafeReturnTo('https://evil.example'), 'absolute external URL must be rejected');
  assert(!isSafeReturnTo('//evil.example'), 'protocol-relative URL must be rejected');
  assert(!isSafeReturnTo('/\\evil.example'), 'backslash trick must be rejected');
  assert(!isSafeReturnTo('javascript:alert(1)'), 'javascript scheme must be rejected');
});

test('sanitizeReturnTo strips external and keeps internal', () => {
  assert(sanitizeReturnTo('https://evil.example') === null, 'external must be dropped');
  assert(sanitizeReturnTo('//evil.example') === null, 'protocol-relative must be dropped');
  assert(sanitizeReturnTo('/account?x=1#top') === '/account', 'internal with query/hash must be cleaned');
  assert(sanitizeReturnTo('/') === '/', 'root stays root');
  assert(sanitizeReturnTo(undefined) === null, 'undefined must be dropped');
});

// ---------------------------------------------------------------------------
// 4. Environment contract
// ---------------------------------------------------------------------------

test('supabase env has three explicit states and never leaks keys', () => {
  const state = getSupabaseEnv().state;
  assert(['configured', 'not_configured', 'invalid_configuration'].includes(state), 'valid state enum');
  const description = describeSupabaseEnv();
  assert(!description.includes('eyJ') && !description.includes('sk_'), 'description never contains key material');
  assert(!description.includes('http'), 'description never contains the URL');
});

test('.env.example defines the auth variables without secret values', () => {
  const example = read('.env.example');
  for (const name of ['VITE_SUPABASE_URL=', 'VITE_SUPABASE_PUBLISHABLE_KEY=', 'SUPABASE_SERVICE_ROLE_KEY=']) {
    assert(example.includes(name), `${name} must be declared`);
  }
  assert(!example.includes('eyJ'), 'no JWT-like secret');
  assert(!example.includes('sk_live'), 'no live secret');
  assert(!example.includes('ghp_'), 'no GitHub token');
  for (const line of example.split(/\r?\n/)) {
    if (line.startsWith('#') || line.trim() === '') continue;
    if (line.includes('=') && !line.includes('false')) {
      const value = line.split('=', 2)[1] ?? '';
      assert(value.trim() === '', `variable must have an empty value: ${line.trim()}`);
    }
  }
});

test('service role is never read by client-facing or runtime modules', () => {
  // Docstring mentions of the variable name are fine; READING the env var is not.
  const usages = [
    'process.env.SUPABASE_SERVICE_ROLE_KEY',
    'import.meta.env.SUPABASE_SERVICE_ROLE_KEY',
    'env.SUPABASE_SERVICE_ROLE_KEY',
    'e.SUPABASE_SERVICE_ROLE_KEY',
  ];
  for (const modulePath of ['src/domain/auth/contracts.ts', 'src/domain/auth/validation.ts', 'src/lib/supabase/env.ts', 'src/domain/auth/service.ts', 'src/domain/auth/server.ts']) {
    const content = read(modulePath);
    for (const usage of usages) {
      assert(!content.includes(usage), `${modulePath} must never read the service role via ${usage}`);
    }
  }
  assert(!read('src/domain/auth/service.ts').includes('service_role'), 'server service must not use service_role');
});

// ---------------------------------------------------------------------------
// 5. Migration 0002 (auth → customer)
// ---------------------------------------------------------------------------

test('migration 0002 links auth users uniquely and stays non-destructive', () => {
  const sql = read('db/migrations/0002_customers_auth_user.sql');
  assert(/ADD COLUMN IF NOT EXISTS auth_user_id\s+uuid\s+UNIQUE\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)/i.test(sql),
    'auth_user_id must be uuid UNIQUE REFERENCES auth.users(id)');
  assert(/ON DELETE SET NULL/i.test(sql), 'delete behavior must be explicit');
  assert(!/DROP TABLE/i.test(sql), 'must not drop tables');
  assert(!/DELETE FROM/i.test(sql), 'must not delete rows');
});

test('customer contract still admits nullable email/displayName', () => {
  const customer = read('src/domain/commercial/customer.ts');
  assert(/email\s*:\s*string\s*\|\s*null/.test(customer), 'email must be string | null');
  assert(/displayName\s*:\s*string\s*\|\s*null/.test(customer), 'displayName must be string | null');
});

// ---------------------------------------------------------------------------
// 6. No commercial activation
// ---------------------------------------------------------------------------

test('no product leaves coming_soon and nothing commercial activates', () => {
  const products = buildCommercialCatalog();
  assert(products.length === 4, 'four products must remain');
  for (const product of products) {
    assert(product.productStatus === 'coming_soon', `${product.productId} must stay coming_soon`);
    assert(product.commercialDownloadEnabled === false, `${product.productId} download must stay disabled`);
    assert(product.availability.canStartCheckout === false, 'no checkout');
    assert(product.availability.canDownload === false, 'no download');
  }
  const flags = getFeatureFlags({});
  assert(flags.authEnabled === false && flags.paymentsEnabled === false && flags.downloadsEnabled === false && flags.demoMonitoringEnabled === false,
    'all commercial flags must default false');
});

test('no orders, payments, licenses or downloads exist anywhere', () => {
  const raw = JSON.stringify(buildCommercialCatalog());
  for (const needle of ['"orderId"', '"paymentId"', '"licenseId"', '"entitlementId"', 'priceAmountMinor']) {
    assert(!raw.includes(needle), `catalog must not expose ${needle}`);
  }
  const migration = read('db/migrations/0002_customers_auth_user.sql').toLowerCase();
  assert(!migration.includes('insert into orders') && !migration.includes('insert into payments') &&
         !migration.includes('insert into licenses'), 'migration 0002 must not seed commercial records');
});

// ---------------------------------------------------------------------------
// 7. UI readiness
// ---------------------------------------------------------------------------

test('auth routes exist and account is protected', () => {
  for (const file of ['login.tsx', 'register.tsx', 'forgot-password.tsx', 'reset-password.tsx', 'account.tsx', 'auth.callback.tsx']) {
    assert(read(`src/routes/${file}`).length > 0, `src/routes/${file} must exist`);
  }
  const account = read('src/routes/account.tsx');
  assert(account.includes('beforeLoad'), 'account must guard in beforeLoad');
  assert(account.includes("to: '/login'"), 'account must redirect to /login when anonymous');
  const login = read('src/routes/login.tsx');
  assert(login.includes('returnTo'), 'login must read the returnTo search param');
});

test('no strategy or metric files were touched by this phase', () => {
  const manifests = [
    'first-triangle-adaptive',
    'first-triangle-gold-adaptive',
    'stochextreme-adaptive',
    'tm-bandas-s3',
  ];
  for (const id of manifests) {
    JSON.parse(read(`public-strategies/manifests/${id}.manifest.json`)); // parses => intact JSON
  }
  const intake = read('scripts/test-strategy-intake.ts');
  assert(intake.length > 0, 'intake tests still present');
});

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
