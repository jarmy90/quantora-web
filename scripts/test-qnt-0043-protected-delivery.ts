/**
 * QNT-0043 · Protected delivery contract tests (offline, no network, no secrets).
 *
 * Proves, without a database or Storage bucket:
 *   - `canFetchDownload` denies everything except available + enabled +
 *     active + granted, and refuses expired rentals (deny by default);
 *   - a paid order grants exactly one active license + granted entitlement,
 *     a rental carries a finite term, and a pending order grants nothing;
 *   - the delivery endpoint checks flag -> session -> product -> grant in that
 *     order, records every served download and never streams bytes or leaks a
 *     vault path;
 *   - the vault is server-only (service role), with 5-minute signed URLs;
 *   - the migration only registers files and audit rows (RLS closed, no
 *     products activated, no prices invented).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EntitlementStatus } from '../src/domain/commercial/entitlement';
import type { LicenseStatus } from '../src/domain/commercial/license';
import type { ProductStatus } from '../src/domain/commercial/product';
import { RENTAL_PERIOD_MS, canFetchDownload, type DownloadAccessInput } from '../src/domain/delivery/access';
import { VAULT_BUCKET, VAULT_SIGNED_URL_TTL_SECONDS } from '../src/domain/delivery/vault';
import { createMemoryLedger, setMemoryProductState } from '../src/domain/payments/ledger';

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
const LIVE_PRODUCT = {
  status: 'available' as ProductStatus,
  commercialDownloadEnabled: true,
};
const input = (
  overrides: Partial<DownloadAccessInput> = {},
): DownloadAccessInput => ({
  product: overrides.product ?? LIVE_PRODUCT,
  license: overrides.license ?? null,
  entitlement: overrides.entitlement ?? null,
  nowMs,
});
const activeLicense = (expiresAt: string | null = null): DownloadAccessInput['license'] => ({
  status: 'active' as LicenseStatus,
  expiresAt,
});
const grantedEntitlement: DownloadAccessInput['entitlement'] = {
  status: 'granted' as EntitlementStatus,
  canDownload: true,
};

// ---------------------------------------------------------------------------
// 1. Access rule: everything denies unless every condition holds
// ---------------------------------------------------------------------------
check(
  'available + enabled + active + granted allows',
  canFetchDownload(input({ license: activeLicense(), entitlement: grantedEntitlement })).allowed === true,
);
check(
  'a not-available product denies with its reason',
  canFetchDownload(
    input({ product: { ...LIVE_PRODUCT, status: 'coming_soon' }, license: activeLicense(), entitlement: grantedEntitlement }),
  ).reason === 'product is not available',
);
check(
  'a download-disabled product denies',
  canFetchDownload(
    input({ product: { ...LIVE_PRODUCT, commercialDownloadEnabled: false }, license: activeLicense(), entitlement: grantedEntitlement }),
  ).reason === 'commercial download is not enabled for this product',
);
check('no license denies', canFetchDownload(input()).reason === 'no license exists');
check(
  'a non-active license denies',
  canFetchDownload(
    input({ license: { status: 'revoked' as LicenseStatus, expiresAt: null }, entitlement: grantedEntitlement }),
  ).reason === 'license status "revoked" is not active',
);
check(
  'an expired rental denies',
  canFetchDownload(
    input({ license: activeLicense(new Date(nowMs - 60_000).toISOString()), entitlement: grantedEntitlement }),
  ).reason === 'license period has expired',
);
check('no entitlement denies', canFetchDownload(input({ license: activeLicense() })).reason === 'no entitlement exists');
check(
  'a suspended entitlement denies',
  canFetchDownload(
    input({ license: activeLicense(), entitlement: { status: 'suspended' as EntitlementStatus, canDownload: true } }),
  ).reason === 'entitlement status "suspended" is not granted',
);
check(
  'an entitlement without canDownload denies',
  canFetchDownload(
    input({ license: activeLicense(), entitlement: { status: 'granted' as EntitlementStatus, canDownload: false } }),
  ).reason === 'entitlement does not allow downloads',
);
check(
  'a rental inside its term allows',
  canFetchDownload(
    input({ license: activeLicense(new Date(nowMs + RENTAL_PERIOD_MS).toISOString()), entitlement: grantedEntitlement }),
  ).allowed === true,
);

// ---------------------------------------------------------------------------
// 2. Ledger: paid orders grant exactly one license + entitlement
// ---------------------------------------------------------------------------
const ledger = createMemoryLedger();
const purchased = await ledger.createOrder({
  customerAuthUserId: 'auth-delivery',
  customerEmail: null,
  productId: 'first-triangle-ustec-m30',
  billingModel: 'purchase',
  amountMinor: 30000,
  currency: 'EUR',
  stripeSessionId: 'cs_delivery',
});
await ledger.applyEvent({ eventId: 'evt_delivery', type: 'checkout.session.completed', orderId: purchased.orderId });
const buyerAccess = await ledger.activeDownloadAccess('auth-delivery', 'first-triangle-ustec-m30');
check('a paid order grants an active license', buyerAccess?.license.status === 'active');
check(
  'the granted entitlement allows downloads',
  buyerAccess?.entitlement.status === 'granted' && buyerAccess?.entitlement.canDownload === true,
);
check('a one-time purchase license never expires', buyerAccess !== null && buyerAccess.license.expiresAt === null);

const rented = await ledger.createOrder({
  customerAuthUserId: 'auth-renter',
  customerEmail: null,
  productId: 'stochextreme-ustec',
  billingModel: 'rental',
  amountMinor: 1000,
  currency: 'EUR',
  stripeSessionId: 'cs_rental',
});
await ledger.applyEvent({ eventId: 'evt_rental', type: 'invoice.paid', orderId: rented.orderId });
const renterAccess = await ledger.activeDownloadAccess('auth-renter', 'stochextreme-ustec');
const renterLicense = renterAccess?.license ?? null;
check('a rental grants a finite license term', renterLicense?.expiresAt !== null);
check(
  'the rental term is about 30 days after creation',
  renterLicense !== null &&
    renterLicense.expiresAt !== null &&
    Math.abs(Date.parse(renterLicense.expiresAt) - Date.parse(rented.createdAt) - RENTAL_PERIOD_MS) < 5_000,
);

const pending = await ledger.createOrder({
  customerAuthUserId: 'auth-delivery',
  customerEmail: null,
  productId: 'first-triangle-ustec-m30',
  billingModel: 'purchase',
  amountMinor: 30000,
  currency: 'EUR',
  stripeSessionId: null,
});
await ledger.grantAccessFromOrder(pending.orderId);
check(
  'a pending order grants nothing (idempotent grant)',
  (await ledger.activeDownloadAccess('auth-delivery', 'first-triangle-ustec-m30'))?.license.orderId ===
    purchased.orderId,
);
check('a stranger has no access', (await ledger.activeDownloadAccess('nobody', 'first-triangle-ustec-m30')) === null);
check(
  'a mirrored available product resolves for the endpoint',
  setMemoryProductState(ledger, {
    productId: 'first-triangle-ustec-m30',
    status: 'available',
    commercialDownloadEnabled: true,
  }) === undefined && (await ledger.productState('first-triangle-ustec-m30'))?.status === 'available',
);
check('unknown products deny by default', (await ledger.productState('anything-else')) === null);

// ---------------------------------------------------------------------------
// 3. Endpoint, vault and UI: server-only delivery, no leaks
// ---------------------------------------------------------------------------
const route = read('src/routes/api/downloads.ts');
const flagAt = route.indexOf('downloadsEnabled');
const authAt = route.indexOf('getAuthStatus()');
const productAt = route.indexOf('ledger.productState(');
const grantAt = route.indexOf('canFetchDownload(');
check('the route checks the DOWNLOADS flag first', flagAt > 0 && flagAt < authAt);
check('the route requires an authenticated session', authAt > 0 && route.includes('auth_required'));
check('the route resolves the product state before the grant', flagAt < authAt && productAt > 0 && productAt < grantAt);
check('the route denies with 403 on any failed condition', route.includes('403'));
check('the route refuses to run unconfigured', route.includes('delivery_not_configured') && route.includes('503'));
check('the route records every served download', route.includes('recordDownloadDownloaded('));
check('the route redirects to a signed URL instead of streaming bytes', route.includes('Response.redirect(signed, 302)'));
check('the route never embeds a bucket or an EA filename', !route.includes('ea-vault') && !route.includes('.ex5'));

const vault = read('src/domain/delivery/vault.ts');
check('the vault needs the service role key together with the database', vault.includes('SUPABASE_SERVICE_ROLE_KEY') && vault.includes('DATABASE_URL'));
check('the vault never uses public client credentials', !vault.includes('VITE_SUPABASE_PUBLISHABLE_KEY'));
check('files resolve from the private registry', vault.includes('FROM product_files'));
check('file rows must carry a valid SHA-256 hash and a size', vault.includes('[0-9a-fA-F]{64}'));
check('signed URLs live 5 minutes', VAULT_SIGNED_URL_TTL_SECONDS === 300);
check('the vault targets its dedicated private bucket', VAULT_BUCKET === 'ea-vault');

const server = read('src/domain/delivery/server.ts');
check('the account view is read-only (no grants, no audit)', !server.includes('grantAccessFromOrder') && !server.includes('recordDownloadDownloaded'));
check('the account view never mints URLs', !server.includes('createSignedUrl') && !server.includes('Response.redirect'));
check('the account view denies everything with the flag off', server.includes('downloads_disabled'));

const ui = read('src/components/CustomerDownloads.tsx');
check('the download button points at the route, never at a file', ui.includes('/api/downloads?product='));
check('no bucket or EA filename appears in the UI', !ui.includes('ea-vault') && !ui.includes('.ex5'));
check('the empty state stays honest', ui.includes('account.downloadsEmpty'));

// ---------------------------------------------------------------------------
// 4. Migration: registry + audit only (no activation, no prices)
// ---------------------------------------------------------------------------
const migration = read('db/migrations/live/003_protected_delivery.sql');
check('the migration registers product files, not binaries', migration.includes('CREATE TABLE IF NOT EXISTS product_files'));
check('file rows must carry a valid SHA-256 hash and a size', migration.includes("sha256 ~ '^[0-9a-fA-F]{64}$'") && migration.includes('bytes > 0'));
check('the migration adds the download audit rows', migration.includes('CREATE TABLE IF NOT EXISTS download_events'));
check(
  'RLS is closed on both new tables',
  migration.includes('ALTER TABLE product_files ENABLE ROW LEVEL SECURITY') &&
    migration.includes('ALTER TABLE download_events ENABLE ROW LEVEL SECURITY'),
);
check(
  'privileges are revoked for anon/authenticated',
  migration.includes('REVOKE ALL ON product_files FROM anon, authenticated') &&
    migration.includes('REVOKE ALL ON download_events FROM anon, authenticated'),
);
check('the migration activates no product and invents no price', !migration.includes('UPDATE products') && !migration.includes('30000') && !migration.includes('1000'));

if (failures > 0) {
  console.error(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('ALL PROTECTED DELIVERY CHECKS PASSED');