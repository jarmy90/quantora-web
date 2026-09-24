/**
 * QNT-0045 · Online licence validation — `POST /api/licenses/validate`.
 *
 * Called by the EA at startup and once a day. No session is required: the
 * licence key IS the credential, and the server binds it to the first MT5
 * account that uses it (anti-sharing). Answers with a tiny JSON payload the EA
 * can parse without a JSON library:
 *
 *   {"valid":true,"expiresAt":"2026-10-22T10:00:00.000Z","reason":"ok"}
 *   {"valid":false,"reason":"license-expired","expiresAt":"..."}
 *
 * Never leaks licence ownership, customer data or keys. Fail closed: without
 * persistence the answer is `valid:false` (503), so an unconfigured server can
 * never unlock an EA.
 */
import { createFileRoute } from '@tanstack/react-router';
import { normalizeLicenseKey } from '../../../domain/licenses/validation';
import { getPaymentLedger } from '../../../domain/payments/ledger';

type ValidatePayload = {
  key?: unknown;
  account?: unknown;
  product?: unknown;
  symbol?: unknown;
  build?: unknown;
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export const Route = createFileRoute('/api/licenses/validate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Accepts both JSON and form-encoded bodies: MT5 WebRequest is happiest
        // with simple form data, but a JSON body is supported too.
        let payload: ValidatePayload = {};
        const contentType = request.headers.get('content-type') ?? '';
        try {
          if (contentType.includes('application/json')) {
            payload = (await request.json()) as ValidatePayload;
          } else {
            const form = await request.formData();
            payload = {
              key: form.get('key'),
              account: form.get('account'),
              product: form.get('product'),
              symbol: form.get('symbol'),
              build: form.get('build'),
            };
          }
        } catch {
          return json({ valid: false, reason: 'invalid-request' }, 400);
        }

        const key = normalizeLicenseKey(payload.key);
        if (!key) return json({ valid: false, reason: 'invalid-key' }, 400);
        const account = typeof payload.account === 'string' || typeof payload.account === 'number'
          ? String(payload.account).trim()
          : '';
        if (!/^\d{4,12}$/.test(account)) return json({ valid: false, reason: 'invalid-account' }, 400);

        const ledger = await getPaymentLedger();
        if (!ledger) return json({ valid: false, reason: 'validation-unavailable' }, 503);

        const decision = await ledger.validateLicenseKey({ licenseKey: key, account });
        const expiresAtEpoch =
          decision.expiresAt === null ? 0 : Math.floor(Date.parse(decision.expiresAt) / 1000) || 0;
        // 200 always (except the failures above): the EA reads `valid`.
        return json(
          {
            valid: decision.valid,
            reason: decision.reason,
            expiresAt: decision.expiresAt,
            // Unix seconds (0 = perpetual): the EA compares it with TimeGMT().
            expiresAtEpoch,
          },
          200,
        );
      },
    },
  },
});
