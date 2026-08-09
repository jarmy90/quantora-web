/**
 * Safe localStorage wrapper. All client persistence in Phase 1 goes through
 * this module so that:
 *   - SSR (no window) never crashes;
 *   - corrupt JSON degrades to a clean read, not an exception;
 *   - the boundary is explicit: local persistence is a DEMO FALLBACK, not a
 *     backend. When a real backend arrives, swap these helpers for server
 *     calls — nothing else in the app needs to change.
 */

const isBrowser = typeof window !== 'undefined';

export function readLocal<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): boolean {
  if (!isBrowser) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeLocal(key: string): void {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Local persistence is intentionally a named fallback, never a silent fake. */
export const LOCAL_PERSISTENCE_NOTICE =
  'Stored locally in your browser only — this is a demo fallback. Nothing is sent to a server.';
