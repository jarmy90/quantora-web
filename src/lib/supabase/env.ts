/**
 * QNT-0013 · Supabase environment contract.
 *
 * Three explicit states:
 *   - configured           both public variables present and well-formed
 *   - not_configured       a required variable is missing entirely
 *   - invalid_configuration a variable is present but malformed
 *
 * CLIENT bundle: `import.meta.env.VITE_*` is replaced at Vite build time.
 * SERVER bundle (`@tanstack/react-start` + `serve.ts`): values are read at
 * runtime from `process.env` (Vercel injects VITE_* + server-only vars into
 * the deployed runtime; a plain `vercel.json` env or `.env` covers the
 * self-hosted `serve.ts`).
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

/**
 * Raw auth env values, split by execution context:
 * - On the server (SSR + server functions under Node/Vercel): read
 *   `process.env` at runtime. This is REQUIRED because Vite statically
 *   replaces `import.meta.env.*` in the server bundle at build time, so
 *   values injected only at deploy-time would otherwise read as undefined.
 * - In the browser: read the Vite-replaced `import.meta.env.VITE_*`.
 */
function raw(): { url: string | null; key: string | null } {
  const isServer = typeof window === 'undefined';
  if (isServer) {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const url = proc?.VITE_SUPABASE_URL ?? proc?.SUPABASE_URL ?? null;
    const key = proc?.VITE_SUPABASE_PUBLISHABLE_KEY ?? proc?.SUPABASE_ANON_KEY ?? null;
    return {
      url: url && url.trim() !== '' ? url.trim() : null,
      key: key && key.trim() !== '' ? key.trim() : null,
    };
  }
  const meta = (() => {
    try {
      return (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    } catch {
      return undefined;
    }
  })();
  const url = meta?.VITE_SUPABASE_URL ?? null;
  const key = meta?.VITE_SUPABASE_PUBLISHABLE_KEY ?? null;
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