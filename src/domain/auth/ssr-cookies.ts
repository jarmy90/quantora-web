/**
 * QNT-0013C · SSR cookie adapter for Supabase sessions.
 *
 * Bridges Supabase's cookie contract (getAll/setAll) to the TanStack Start
 * request/response context. Both the access token and the refresh token are
 * kept in separate HttpOnly cookies — the refresh token is never discarded,
 * so sessions can actually be renewed.
 *
 * Cookies:
 *   quantora-auth-token    access token (HttpOnly, SameSite=Lax, Secure in prod)
 *   quantora-refresh-token refresh token (HttpOnly, SameSite=Lax, Secure in prod)
 *   quantora-code-verifier PKCE verifier, survives redirects (HttpOnly)
 *
 * No token ever reaches the client bundle; the UI only receives safe user
 * shapes from the server functions.
 */
import { getRequest, setResponseHeader } from '@tanstack/react-start-server';

export const ACCESS_COOKIE = 'quantora-auth-token';
export const REFRESH_COOKIE = 'quantora-refresh-token';
export const VERIFIER_COOKIE = 'quantora-code-verifier';

export type SsrCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function secureContext(): boolean {
  return Boolean(import.meta.env.PROD) || Boolean((import.meta.env.VITE_SITE_URL as string | undefined)?.startsWith('https'));
}

export function serialize(name: string, value: string, options: Record<string, unknown>): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires !== undefined) parts.push(`Expires=${String(options.expires)}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

function parseCookieHeader(header: string): { name: string; value: string }[] {
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=');
      if (eq === -1) return { name: part, value: '' };
      return { name: part.slice(0, eq).trim(), value: decodeURIComponent(part.slice(eq + 1)) };
    });
}

/**
 * Returns the request's cookies and a setter that queues Set-Cookie headers
 * on the current response. Expired cookies (maxAge 0) are removed.
 */
export function createSsrCookieAdapter(): {
  getAll: () => SsrCookie[];
  setAll: (cookies: SsrCookie[]) => void;
} {
  const secure = secureContext();
  const requestCookies = parseCookieHeader(getRequest().headers.get('cookie') ?? '');
  const queue = new Map<string, string>();

  const getAll = (): SsrCookie[] =>
    requestCookies.map((c) => ({
      name: c.name,
      value: c.value,
      options: { path: '/', httpOnly: true, sameSite: 'lax', secure },
    }));

  const setAll = (cookies: SsrCookie[]): void => {
    for (const cookie of cookies) {
      const maxAge = typeof cookie.options.maxAge === 'number' ? cookie.options.maxAge : undefined;
      const options = {
        path: '/',
        httpOnly: true,
        sameSite: 'lax' as const,
        secure,
        maxAge,
        expires: cookie.options.expires as Date | undefined,
      };
      if (maxAge !== undefined && maxAge <= 0) {
        // Expire + delete: Supabase emits maxAge=0 on sign-out for every auth
        // cookie; we must remove them from the response too.
        queue.set(cookie.name, serialize(cookie.name, '', { ...options, maxAge: 0 }));
      } else {
        queue.set(cookie.name, serialize(cookie.name, cookie.value, options));
      }
    }
  };

  return {
    getAll,
    setAll: (cookies) => {
      setAll(cookies);
      // Flush the queued cookies onto the real response after each call so
      // the RPC response carries them back to the browser.
      for (const header of queue.values()) {
        setResponseHeader('set-cookie', header);
      }
      queue.clear();
    },
  };
}

/** Remove every session cookie (used by sign-out, mirroring Supabase). */
export function clearAllSessionCookies(): void {
  const secure = secureContext();
  for (const name of ['quantora-auth-token', 'quantora-refresh-token', 'quantora-code-verifier']) {
    setResponseHeader('set-cookie', serialize(name, '', { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: 0 }));
  }
}

/** Store the PKCE code verifier so the callback can exchange it. */
export function persistVerifier(verifier: string): void {
  const secure = secureContext();
  setResponseHeader('set-cookie', serialize(VERIFIER_COOKIE, verifier, { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: 60 * 10 }));
}
