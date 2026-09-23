/**
 * QNT-0043 · Private EA vault (Supabase Storage, server-only).
 *
 * The Expert Advisor binaries live in the private `ea-vault` bucket; Git, the
 * public bundle and the browser never see them. This module resolves, on the
 * server only:
 *   1. which private object serves a product (`product_files`, in Neon);
 *   2. a short-lived signed URL for that object (Supabase Storage, service role).
 *
 * `createVaultSigner()` returns `null` unless every credential is present —
 * the endpoint answers 503 instead of pretending to deliver. The Supabase SDK
 * is imported lazily so it never enters the client bundle.
 */
import { sql } from '../../db';

export const VAULT_BUCKET = 'ea-vault';
/** Signed URLs expire in 5 minutes (short enough to make sharing pointless). */
export const VAULT_SIGNED_URL_TTL_SECONDS = 300;

export type VaultFile = {
  path: string;
  sha256: string;
  bytes: number;
};

export interface VaultSigner {
  fileFor(productId: string): Promise<VaultFile | null>;
  signPath(path: string, ttlSeconds?: number): Promise<string | null>;
}

type Row = Record<string, unknown>;
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
const numOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

export async function createVaultSigner(): Promise<VaultSigner | null> {
  if (typeof process === 'undefined') return null;
  const dbUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !supabaseUrl || !serviceKey) return null;

  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  return {
    async fileFor(productId: string) {
      if (productId.length === 0) return null;
      const rows = (await sql()`
        SELECT path, sha256, bytes FROM product_files WHERE product_id = ${productId} LIMIT 1
      `) as Row[];
      if (rows.length === 0) return null;
      const row = rows[0];
      const bytes = numOrNull(row.bytes);
      const sha256 = text(row.sha256);
      const path = text(row.path);
      if (!path || !/^[0-9a-fA-F]{64}$/.test(sha256) || bytes === null || bytes <= 0) return null;
      return { path, sha256, bytes };
    },
    async signPath(path: string, ttlSeconds: number = VAULT_SIGNED_URL_TTL_SECONDS) {
      if (path.length === 0 || ttlSeconds <= 0) return null;
      try {
        const { data, error } = await client.storage.from(VAULT_BUCKET).createSignedUrl(path, ttlSeconds);
        if (error || !data?.signedUrl) return null;
        return data.signedUrl;
      } catch {
        return null;
      }
    },
  };
}
