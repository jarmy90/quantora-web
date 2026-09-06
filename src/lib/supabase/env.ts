/**
 * QNT-0013 · Supabase environment contract.
 *
 * Three explicit states:
 *   - configured           both public variables present and well-formed
 *   - not_configured       a required variable is missing entirely
 *   - invalid_configuration a variable is present but malformed (e.g. the URL
 *                           does not parse as http(s))
 *
 * Only the PUBLIC pair (VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY) is
 * read here. SUPABASE_SERVICE_ROLE_KEY is server-only and never touches this
 * module's public surface — it must never be imported by the browser bundle.
 *
 * Import-safe on both sides:
 *   - Client: import.meta.env carries the VITE_ values (replaced at build time).
 *   - Server (Nitro/SSR): import.meta.env is undefined at runtime, so we fall
 *     back to process.env. Vercel injects VITE_SUPABASE_* into process.env
 *     for server functions, so both environments are covered.
 */
export type SupabaseEnvState =
  | 'configured'
  | 'not_configured'
  | 'invalid_configuration';

export type SupabaseEnv = {
  state: SupabaseEnvState;
  url: string | null;
  publishableKey: string | null;
};

function looksLikeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Read VITE_ vars from import.meta.env (client, replaced at build time) or
 * from process.env (server/Nitro runtime). The fallback ensures the SSR
 * render matches the client when Vercel injects VITE_SUPABASE_* at runtime.
 */
function raw(): { url: string | null; key: string | null } {
  // Build-time replacement (client bundle, or SSR bundle when vars were set
  // at Vite build time).
  const metaUrl = (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? undefined;
  const metaKey = (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? undefined;

  // Runtime fallback for Nitro server functions: process.env is always
  // available in Node/Bun and is populated by Vercel's serverless runtime.
  const procUrl =
    typeof process !== 'undefined' ? (process.env['VITE_SUPABASE_URL'] ?? undefined) : undefined;
  const procKey =
    typeof process !== 'undefined'
      ? (process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? undefined)
      : undefined;

  const url = metaUrl ?? procUrl ?? null;
  const key = metaKey ?? procKey ?? null;

  return {
    url: url && url.trim() !== '' ? url.trim() : null,
    key: key && key.trim() !== '' ? key.trim() : null,
  };
}

export function getSupabaseEnv(): SupabaseEnv {
  const { url, key } = raw();
  if (!url || !key) {
    return { state: 'not_configured', url: null, publishableKey: null };
  }
  if (!looksLikeUrl(url) || key.length < 8) {
    return { state: 'invalid_configuration', url, publishableKey: key };
  }
  return { state: 'configured', url, publishableKey: key };
}

/** Convenience: is auth ready to actually talk to Supabase? */
export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv().state === 'configured';
}

/** Safe human summary — never includes keys. */
export function describeSupabaseEnv(): string {
  const env = getSupabaseEnv();
  if (env.state === 'configured') return 'supabase=configured';
  if (env.state === 'invalid_configuration') return 'supabase=invalid_configuration';
  return 'supabase=not_configured';
}