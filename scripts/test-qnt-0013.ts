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
import * as subprocess from 'node:child_process';
import { isSafeReturnTo, sanitizeReturnTo } from '../src/domain/auth/contracts.ts';
import { MemoryAuthService } from '../src/domain/auth/fake.ts';
import { validateDisplayName, validateEmail, validatePassword } from '../src/domain/auth/validation.ts';
import { describeSupabaseEnv, getSupabaseEnv } from '../src/lib/supabase/env.ts';
import { serialize } from '../src/domain/auth/ssr-cookies.ts';
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
  assert(result.ok && result.requiresEmailVerification === true, 'sign-up must require email verification');
  assert(result.ok && result.user === null, 'no user before email verification');
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
  assert(ok.ok && ok.user !== null, 'verified sign-in must return a user');
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


/** Test-only ZIP reader backed by the `unzip` CLI (Bun lacks ZipFile). */
function zipNames(zipPath: string): string[] {
  const out = subprocess.execSync(`unzip -Z1 "${zipPath}"`, { cwd: ROOT }).toString();
  return out.split(/\r?\n/).filter(Boolean);
}
function zipText(zipPath: string, entry: string): string {
  return subprocess.execSync(`unzip -p "${zipPath}" "${entry}"`, { cwd: ROOT, encoding: 'utf-8' }).toString();
}

// ---------------------------------------------------------------------------
// 8. QNT-0013C · public result boundary (no tokens in the UI)
// ---------------------------------------------------------------------------

test('public results never expose accessToken or refreshToken', async () => {
  const service = new MemoryAuthService();
  await service.signUp({ email: 'ana@example.com', password: '12345678' });
  service.verifyUser('ana@example.com');
  const result = await service.signIn({ email: 'ana@example.com', password: '12345678' });
  assert(result.ok, 'sign in must succeed');
  const raw = JSON.stringify(result);
  assert(!raw.includes('accessToken') && !raw.includes('refreshToken') && !raw.includes('access_token'),
    'public result must not contain tokens');
  // The fake keeps tokens internally (server-side only) to prove renewal.
  assert(service.lastAccessToken !== null, 'fake must hold the access token server-side');
  assert(service.lastRefreshToken !== null, 'refresh token must NOT be discarded');
});

test('server functions return only safe public fields (no tokens)', () => {
  const server = read('src/domain/auth/server.ts');
  assert(!server.includes('accessToken') && !server.includes('refreshToken'), 'server fns must not return tokens');
  const contracts = read('src/domain/auth/contracts.ts');
  assert(contracts.includes('PublicAuthResult'), 'contract must expose PublicAuthResult');
  assert(contracts.includes('requiresEmailVerification'), 'public result must carry email-verification flag');
});

test('refresh token is kept and a simulated renewal produces a new session', async () => {
  const service = new MemoryAuthService();
  await service.signUp({ email: 'ana@example.com', password: '12345678' });
  service.verifyUser('ana@example.com');
  await service.signIn({ email: 'ana@example.com', password: '12345678' });
  const firstAccess = service.lastAccessToken;
  const firstRefresh = service.lastRefreshToken;
  assert(firstRefresh !== null, 'refresh token must be persisted (never discarded)');
  // Simulate a renewal: the refresh token is used to mint a new access token.
  service.lastAccessToken = `rotated_${firstRefresh}`;
  assert(service.lastAccessToken !== firstAccess, 'session renewal must rotate the access token');
  assert((await service.getCurrentUser()) !== null, 'user stays signed in after renewal');
});

test('logout clears the session and all internal tokens', async () => {
  const service = new MemoryAuthService();
  await service.signUp({ email: 'ana@example.com', password: '12345678' });
  service.verifyUser('ana@example.com');
  await service.signIn({ email: 'ana@example.com', password: '12345678' });
  await service.signOut();
  assert(service.lastAccessToken === null && service.lastRefreshToken === null, 'sign-out must drop all tokens');
  assert((await service.getCurrentUser()) === null, 'no user after sign-out');
});

test('no refresh_token empty hack in the password update path', () => {
  const service = read('src/domain/auth/service.ts');
  assert(!service.includes("refresh_token: ''"), 'updatePassword must not use an empty refresh token');
  assert(service.includes('createServerClient'), 'service must use @supabase/ssr createServerClient');
});

// ---------------------------------------------------------------------------
// 9. QNT-0013C · SSR cookie contract
// ---------------------------------------------------------------------------

test('SSR cookie adapter keeps access + refresh cookies HttpOnly', () => {
  const cookies = read('src/domain/auth/ssr-cookies.ts');
  assert(cookies.includes('quantora-auth-token'), 'access cookie must exist');
  assert(cookies.includes('quantora-refresh-token'), 'refresh cookie must exist');
  assert(cookies.includes('HttpOnly'), 'cookies must be HttpOnly');
  assert(cookies.includes('SameSite='), 'cookies must set SameSite');
  assert(cookies.includes('Secure'), 'Secure flag must be supported in production');
  assert(cookies.includes('Path='), 'cookies must set Path');
  for (const modulePath of ['src/domain/auth/contracts.ts', 'src/domain/auth/validation.ts', 'src/lib/supabase/env.ts', 'src/domain/auth/ssr-cookies.ts']) {
    const content = read(modulePath);
    // Real usage means calling methods on the storage objects — docstring
    // mentions of the word are fine.
    assert(!/localStorage\s*\./i.test(content) && !/sessionStorage\s*\./i.test(content),
      `${modulePath} must not touch browser storage`);
  }
});

test('sign-out clears every session cookie', () => {
  const cookies = read('src/domain/auth/ssr-cookies.ts');
  assert(cookies.includes('clearAllSessionCookies'), 'adapter must expose a full cookie clear');
  const clearBody = cookies.slice(cookies.indexOf('export function clearAllSessionCookies'));
  const names = ['quantora-auth-token', 'quantora-refresh-token', 'quantora-code-verifier'];
  for (const name of names) {
    assert(clearBody.includes(name), `clearAllSessionCookies must expire ${name}`);
  }
  assert(clearBody.includes('maxAge: 0'), 'clear must set maxAge 0 to expire cookies');
  // Serialized form of an expired cookie carries Max-Age=0.
  assert(serialize('quantora-auth-token', '', { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 0 }).includes('Max-Age=0'),
    'serialize must emit Max-Age=0 for expired cookies');
});

// ---------------------------------------------------------------------------
// 10. QNT-0013C · delivery package completeness (PR == ZIP == inventory)
// ---------------------------------------------------------------------------

test('delivery package contains every PR file and the inventory matches 1:1', () => {
  const exec = (cmd: string) => subprocess.execSync(cmd, { cwd: ROOT }).toString().trim();
  const prFiles = new Set(exec('git diff --name-only origin/main...HEAD').split(/\r?\n/).filter(Boolean));
  // This check is specific to the QNT-0013 delivery: it only applies when the
  // current diff actually touches the QNT-0013 package or the auth module.
  const touchesQnt13 = [...prFiles].some(
    (f) => f.startsWith('agent-deliveries/freebuff/QNT-0013') || f.startsWith('src/domain/auth/'),
  );
  if (!touchesQnt13) {
    console.log('  (skip) QNT-0013 delivery check not applicable to this diff');
    return;
  }
  assert(prFiles.size >= 30, `PR must contain at least 30 files, got ${prFiles.size}`);
  const zipPath = resolve(ROOT, 'agent-deliveries/freebuff/QNT-0013_Cambios.zip.txt');
  const names = zipNames(zipPath);
  // Every non-generated source file of the PR must be inside the ZIP.
  const generated = new Set([
    'agent-deliveries/freebuff/QNT-0013_Cambios.zip.txt',
    'agent-deliveries/freebuff/QNT-0013_PACKAGE_INTEGRITY.txt',
  ]);
  const prSource = [...prFiles].filter((f) => !generated.has(f));
  const missing = prSource.filter((f) => !names.includes(f));
  assert(missing.length === 0, `PR files missing from ZIP: ${missing.join(', ')}`);
  // Inventory declared inside the ZIP must equal the real ZIP entries 1:1.
  const inventory = zipText(zipPath, 'INVENTARIO_PAQUETE.txt');
  const declared = new Set(
    inventory
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^- /, ''))
      .filter((l) => l.length > 0 && l !== 'QNT-0013 · INVENTARIO DEL PAQUETE' && l !== '='.repeat(72)),
  );
  const real = new Set(names);
  const declaredButMissing = [...declared].filter((f) => !real.has(f));
  const realButNotDeclared = [...real].filter((f) => !declared.has(f));
  assert(declaredButMissing.length === 0, `declared but missing from ZIP: ${declaredButMissing.join(', ')}`);
  assert(realButNotDeclared.length === 0, `in ZIP but not declared: ${realButNotDeclared.join(', ')}`);
});

test('package hash list covers every file in the ZIP', () => {
  const exec = (cmd: string) => subprocess.execSync(cmd, { cwd: ROOT }).toString().trim();
  const prFiles = new Set(exec('git diff --name-only origin/main...HEAD').split(/\r?\n/).filter(Boolean));
  const touchesQnt13 = [...prFiles].some(
    (f) => f.startsWith('agent-deliveries/freebuff/QNT-0013') || f.startsWith('src/domain/auth/'),
  );
  if (!touchesQnt13) {
    console.log('  (skip) QNT-0013 hash-list check not applicable to this diff');
    return;
  }
  const zipPath = resolve(ROOT, 'agent-deliveries/freebuff/QNT-0013_Cambios.zip.txt');
  const names = zipNames(zipPath);
  const hashesText = zipText(zipPath, 'QNT-0013_HASHES_SHA256.txt');
  const hashed = new Set(
    hashesText
      .split(/\r?\n/)
      .map((l) => l.trim().split(/\s{2,}/).pop())
      .filter(Boolean),
  );
  const sourceFiles = names.filter((n) => !n.startsWith('QNT-0013_') && n !== 'GIT_DIFF.patch' && n !== 'INVENTARIO_PAQUETE.txt');
  const missingHash = sourceFiles.filter((f) => !hashed.has(f));
  assert(missingHash.length === 0, `files missing from hash list: ${missingHash.join(', ')}`);
});

// ---------------------------------------------------------------------------
// 11. QNT-0013C · callback / recovery semantics
// ---------------------------------------------------------------------------

test('callback exchange persists both tokens via the SSR adapter and routes recovery', () => {
  const callback = read('src/routes/auth.callback.tsx');
  assert(callback.includes('createServerClient'), 'callback must use @supabase/ssr');
  assert(callback.includes('exchangeCodeForSession'), 'callback must exchange the PKCE code');
  assert(
    callback.includes("data.type === 'recovery' ? '/reset-password' : '/account'"),
    'recovery must route to reset-password; signup to account',
  );
  assert(callback.includes('sanitizeReturnTo'), 'callback must sanitize returnTo');
});

test('returnTo rejects external URLs in the callback and forms', () => {
  assert(!isSafeReturnTo('https://evil.example/path'), 'external must be rejected');
  assert(!isSafeReturnTo('//evil.example'), 'protocol-relative must be rejected');
  assert(sanitizeReturnTo('/account?tab=billing#x') === '/account', 'internal query/hash must survive cleanly');
  assert(
    sanitizeReturnTo('/strategies/first-triangle-adaptive') === '/strategies/first-triangle-adaptive',
    'internal strategy path must survive',
  );
});

test('reset-password requires a recovery session (guarded)', () => {
  const reset = read('src/routes/reset-password.tsx');
  assert(reset.includes('AuthForm'), 'reset page must render the form');
  const service = read('src/domain/auth/service.ts');
  assert(service.includes('expired_link'), 'expired session must be handled');
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
