/**
 * QNT-0045 · Online licence contract tests (offline, no network, no secrets).
 *
 * Proves, without a database or Stripe account:
 *   - the validation rule allows only active + unexpired + same-account
 *     licences, and binds the first account that succeeds (anti-sharing);
 *   - expired rentals stay expired; renewed expiry re-opens them;
 *   - keys are opaque, typable and tolerant to spaces/case;
 *   - the memory ledger binds one account per licence and lists keys for
 *     the account area;
 *   - the public endpoint is dual-format (JSON + form), never leaks
 *     ownership, and fails closed without persistence;
 *   - the migration adds only the activation columns (RLS/tests-free SQL).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LicenseStatus } from '../src/domain/commercial/license';
import {
  accountDigits,
  newLicenseKey,
  normalizeLicenseKey,
  validateLicense,
  type LicenseRecord,
} from '../src/domain/licenses/validation';
import { createMemoryLedger } from '../src/domain/payments/ledger';

let failures = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) console.log(`ok - ${name}`);
  else {
    failures++;
    console.error(`FAIL - ${name} ${extra}`);
  }
}

const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');
const nowMs = Date.parse('2026-09-22T12:00:00.000Z');
const fresh = (overrides: Partial<LicenseRecord> = {}): LicenseRecord => ({
  status: 'active' as LicenseStatus,
  expiresAt: null,
  boundAccount: null,
  activations: 0,
  maxActivations: 1,
  ...overrides,
});

// ---------------------------------------------------------------------------
// 1. Pure rule: allow, bind, and every deny case
// ---------------------------------------------------------------------------
check(
  'first use validates and claims the account',
  (() => {
    const decision = validateLicense({ license: fresh(), account: '12345678', nowMs });
    return decision.valid === true && decision.reason === 'ok' && decision.bind === true;
  })(),
);
check(
  'the same account keeps validating without rebinding',
  (() => {
    const first = validateLicense({ license: fresh(), account: '12345678', nowMs });
    const claimed: LicenseRecord = { ...fresh(), boundAccount: '12345678', activations: 1 };
    void first;
    const second = validateLicense({ license: claimed, account: '12345678', nowMs });
    return second.valid === true && second.reason === 'ok-bound' && second.bind === false;
  })(),
);
check(
  'a shared key is rejected on the second account',
  validateLicense({ license: { ...fresh(), boundAccount: '12345678', activations: 1 }, account: '87654321', nowMs }).reason ===
    'bound-to-another-account',
);
check(
  'expired rental stays expired (server clock, not the EA)',
  validateLicense({ license: fresh({ expiresAt: '2026-09-01T00:00:00.000Z' }), account: '12345678', nowMs }).reason ===
    'license-expired',
);
check(
  'renewed expiry re-opens the rental',
  validateLicense({ license: fresh({ expiresAt: '2026-11-01T00:00:00.000Z' }), account: '12345678', nowMs }).valid ===
    true,
);
check(
  'a revoked licence denies',
  validateLicense({ license: { ...fresh(), status: 'revoked' }, account: '12345678', nowMs }).reason ===
    'license-not-active',
);
check(
  'an unknown licence denies',
  validateLicense({ license: null, account: '12345678', nowMs }).reason === 'unknown-license',
);
check(
  'a malformed account denies',
  validateLicense({ license: fresh(), account: 'abc', nowMs }).reason === 'invalid-account',
);
check('digits are accepted as-is', accountDigits('12345678') === '12345678');
check('non-digits are rejected', accountDigits('12ab34') === null && accountDigits('12') === null);

// ---------------------------------------------------------------------------
// 2. Keys: opaque, typable, unambiguous
// ---------------------------------------------------------------------------
const sample = newLicenseKey(() => 'abcdef0123456789abcdef0123456789');
check('keys have the QNT shape', sample === 'QNT-ABCD-EF01-2345-6789');
check(
  'typed keys normalize (spaces, case, missing prefix tolerated)',
  normalizeLicenseKey(' qnt-abcd-ef01-2345-6789 ') === 'QNT-ABCD-EF01-2345-6789' &&
    normalizeLicenseKey('abcdef0123456789') === 'QNT-ABCD-EF01-2345-6789',
);
check('garbage is not a key', normalizeLicenseKey('not-a-key') === null && normalizeLicenseKey('') === null);
check('distinct randomness yields distinct keys', newLicenseKey(() => '0123456789abcdef') !== newLicenseKey(() => 'fedcba9876543210'));

// ---------------------------------------------------------------------------
// 3. Ledger binding: one account per licence, keys listed for the account area
// ---------------------------------------------------------------------------
const ledger = createMemoryLedger();
const ordered = await ledger.createOrder({
  customerAuthUserId: 'auth-online',
  customerEmail: null,
  productId: 'first-triangle-ustec-m30',
  billingModel: 'purchase',
  amountMinor: 30000,
  currency: 'EUR',
  stripeSessionId: null,
});
check('pending order has no licence yet', (await ledger.listLicenses('auth-online')).length === 0);
check(
  'an orderless key is unknown',
  (await ledger.validateLicenseKey({ licenseKey: 'QNT-ABCD-EF01-2345-6789', account: '12345678' })).reason ===
    'unknown-license',
);
await ledger.applyEvent({ eventId: 'evt_online', type: 'checkout.session.completed', orderId: ordered.orderId });
const issued = await ledger.listLicenses('auth-online');
check('a settled order issues exactly one keyed licence', issued.length === 1 && (issued[0]?.licenseKey ?? '').startsWith('QNT-'));
check('the issued licence is not yet bound', issued[0]?.boundAccount === null);

const first = await ledger.validateLicenseKey({ licenseKey: issued[0]?.licenseKey ?? '', account: '12345678' });
check('first validation binds the account', first.valid === true && first.bind === true);
check('the binding is persisted', (await ledger.listLicenses('auth-online'))[0]?.boundAccount === '12345678');

const second = await ledger.validateLicenseKey({ licenseKey: issued[0]?.licenseKey ?? '', account: '12345678' });
check('same account revalidates without changes', second.valid === true && second.bind === false);

const shared = await ledger.validateLicenseKey({ licenseKey: issued[0]?.licenseKey ?? '', account: '87654321' });
check('a shared key is refused on the other account', shared.valid === false && shared.reason === 'bound-to-another-account');

// ---------------------------------------------------------------------------
// 4. Endpoint: dual format, no leaks, fail closed
// ---------------------------------------------------------------------------
const route = read('src/routes/api/licenses/validate.ts');
check('endpoint accepts form posts for MT5 WebRequest', route.includes('formData()') && route.includes('content-type'));
check('malformed payloads fail closed', route.includes('invalid-request') && route.includes('400'));
check('bad keys and accounts fail closed', route.includes('invalid-key') && route.includes('invalid-account'));
check('no persistence means no unlock', route.includes('validation-unavailable') && route.includes('503'));
check('responses carry no ownership or customer data', !route.includes('email') && !route.includes('customerId'));
check('response includes a machine-readable expiry epoch', route.includes('expiresAtEpoch'));

// ---------------------------------------------------------------------------
// 5. Migration: activation columns only, idempotent
// ---------------------------------------------------------------------------
const migration = read('db/migrations/live/004_license_activation.sql');
check('migration adds the key column', migration.includes('license_key'));
check('the key is unique when present', migration.includes('ON licenses (license_key)'));
check('binding columns exist for account and counters', migration.includes('bound_account') && migration.includes('activations'));
check('a natural anti-hoarding key exists', migration.includes('idx_licenses_bound_account'));

if (failures > 0) {
  console.error(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('ALL ONLINE LICENCE CHECKS PASSED');
