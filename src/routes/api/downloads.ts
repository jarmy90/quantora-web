/**
 * QNT-0043 · Protected EA delivery — `GET /api/downloads?product=<productId>`.
 *
 * The route never streams the binary itself: it runs the full access check
 * server-side and, only when every condition holds, answers with a 302 to a
 * short-lived signed Storage URL. Binaries live in the private Storage bucket;
 * URLs expire in 5 minutes and every served download is audited.
 *
 * Deny paths (never a download, never a leak):
 *   401 unauthenticated · 403 downloads off / not available / no active
 *   license / expired rental / no granted entitlement · 404 unknown product or
 *   missing file · 503 delivery not configured.
 */
import { createFileRoute } from '@tanstack/react-router';
import { getFeatureFlags } from '../../config';
import { getAuthStatus } from '../../domain/auth/server';
import type { EntitlementStatus } from '../../domain/commercial/entitlement';
import type { LicenseStatus } from '../../domain/commercial/license';
import type { ProductStatus } from '../../domain/commercial/product';
import { canFetchDownload } from '../../domain/delivery/access';
import { createVaultSigner } from '../../domain/delivery/vault';
import { getPaymentLedger } from '../../domain/payments/ledger';

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export const Route = createFileRoute('/api/downloads')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const env = typeof process === 'undefined' ? {} : process.env;
        if (!getFeatureFlags(env).downloadsEnabled) {
          return json({ ok: false, error: 'downloads_disabled' }, 403);
        }

        const status = await getAuthStatus();
        if (!status.user) return json({ ok: false, error: 'auth_required' }, 401);

        const url = new URL(request.url);
        const productId = (url.searchParams.get('product') ?? '').trim();
        if (!productId) return json({ ok: false, error: 'unknown_product' }, 400);

        const ledger = await getPaymentLedger();
        if (!ledger) return json({ ok: false, error: 'delivery_not_configured' }, 503);

        const product = await ledger.productState(productId);
        if (!product) return json({ ok: false, error: 'unknown_product' }, 404);

        const access = await ledger.activeDownloadAccess(status.user.id, productId);
        const decision = canFetchDownload({
          product: {
            status: product.status as ProductStatus,
            commercialDownloadEnabled: product.commercialDownloadEnabled === true,
          },
          license: access
            ? { status: access.license.status as LicenseStatus, expiresAt: access.license.expiresAt }
            : null,
          entitlement: access
            ? {
                status: access.entitlement.status as EntitlementStatus,
                canDownload: access.entitlement.canDownload === true,
              }
            : null,
        });
        if (!decision.allowed) return json({ ok: false, error: 'forbidden' }, 403);

        const vault = await createVaultSigner();
        if (!vault) return json({ ok: false, error: 'delivery_not_configured' }, 503);
        const file = await vault.fileFor(productId);
        if (!file) return json({ ok: false, error: 'file_not_found' }, 404);
        const signed = await vault.signPath(file.path);
        if (!signed) return json({ ok: false, error: 'delivery_unavailable' }, 503);

        await ledger.recordDownloadDownloaded(
          status.user.id,
          productId,
          access?.license.licenseId ?? null,
          access?.license.orderId ?? null,
        );
        return Response.redirect(signed, 302);
      },
    },
  },
});
