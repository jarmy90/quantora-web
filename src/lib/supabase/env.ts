/**
 * QNT-0013 · Supabase environment contract.
 *
 * Three explicit states:
 *   - configured           both public variables present and well-formed
 *   - not_configured       a required variable is missing entirely
 *   - invalid_configuration a variable is present but malformed
 *
 * Only the PUBLIC pair (VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY) is
 * read here. These are replaced at Vite build-time in the client bundle.
 *
 * IMPORTANT: These vars are only present in the CLIENT bundle (import.meta.env
 * is replaced at build time for client-side code). The SSR bundle does NOT have
 * them because Vite's SSR build runs in a different context. Auth components
 * must use useSupabaseConfigured() (client-only) instead of isSupabaseConfigured()
 * to avoid SSR hydration mismatches.
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

/** Raw VITE_ values — only valid in client bundle (replaced at build time). */
function raw(): { url: string | null; key: string | null } {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? null;
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? null;
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

/** Synchronous check — use only in CLIENT-ONLY code paths. */
export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv().state === 'configured';
}

/**
 * SSR-safe check: returns null during SSR (unknown), true/false on the client.
 * Use this in React components to avoid SSR/client hydration mismatches.
 * The values are only available after the client bundle is evaluated.
 */
export function isSupabaseConfiguredSafe(): boolean | null {
  if (typeof window === 'undefined') return null;
  return isSupabaseConfigured();
}

/** Safe human summary — never includes keys. */
export function describeSupabaseEnv(): string {
  const env = getSupabaseEnv();
  if (env.state === 'configured') return 'supabase=configured';
  if (env.state === 'invalid_configuration') return 'supabase=invalid_configuration';
  return 'supabase=not_configured';
}