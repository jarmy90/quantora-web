/**
 * QNT-0025 · Stripe signature verification (pure helper, no SDK).
 *
 * Verifies the Stripe-Signature header using HMAC-SHA256 over the RAW body:
 *   expected = HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
 * Compares against every v1 signature with a timing-safe comparison and
 * enforces a timestamp tolerance (default 300s) against replay attacks.
 *
 * Secrets are never logged here — callers pass them in and never echo them.
 */
export type StripeSignatureCheck =
  | { ok: true; timestamp: number }
  | { ok: false; reason: string };

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): Promise<StripeSignatureCheck> {
  if (!signatureHeader) return { ok: false, reason: 'missing signature header' };
  if (!secret) return { ok: false, reason: 'missing webhook secret' };
  const parts = signatureHeader.split(',').map((p) => p.trim());
  let timestamp: number | null = null;
  const v1: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't' && v && Number.isFinite(Number(v))) timestamp = Number(v);
    if (k === 'v1' && v) v1.push(v);
  }
  if (timestamp === null) return { ok: false, reason: 'missing timestamp' };
  if (v1.length === 0) return { ok: false, reason: 'missing v1 signature' };
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return { ok: false, reason: 'timestamp outside tolerance' };
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  for (const sig of v1) {
    if (timingSafeEqualHex(sig.toLowerCase(), expected.toLowerCase())) {
      return { ok: true, timestamp };
    }
  }
  return { ok: false, reason: 'signature mismatch' };
}
