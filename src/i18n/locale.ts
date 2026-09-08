/**
 * QNT-0021-I18N · Locale resolution core (isomorphic, dependency-free).
 *
 * Precedence (highest first):
 *  1. Explicit user selection — persisted in the `quantora_locale` cookie.
 *  2. Accept-Language (server) / navigator.languages (client fallback).
 *  3. English (en-US) as safe fallback.
 *
 * No IP geolocation, no country/timezone heuristics and no external
 * translation APIs are used. The cookie accepts only the normalized tags
 * 'en' | 'es'.
 *
 * SSR: the first HTML response already uses the resolved locale (set in the
 * root route's beforeLoad before any component renders), so there is no
 * English→Spanish flash on hydration; on the client the active locale is
 * seeded from <html lang>, which guarantees SSR and hydration agree.
 * Known limitation (docs/I18N_ARCHITECTURE.md): concurrent SSR requests share
 * this module slot (last-set-wins); a request-scoped store is planned later.
 */

export type LocaleTag = 'en' | 'es';
export type SupportedLocale = 'en-US' | 'es-ES';

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';
export const LOCALE_COOKIE = 'quantora_locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const LOCALE_BY_TAG: Record<LocaleTag, SupportedLocale> = {
  en: 'en-US',
  es: 'es-ES',
};

export const SUPPORTED_TAGS: readonly LocaleTag[] = ['en', 'es'];

/** BCP-47 tag → browser/HTML lang attribute: en-US→en, es-ES→es. */
export function htmlLangForLocale(locale: SupportedLocale): string {
  return toTag(locale);
}

/** Reverse mapping: SupportedLocale → normalized cookie tag. */
export function toTag(locale: SupportedLocale): LocaleTag {
  return locale === 'es-ES' ? 'es' : 'en';
}

/** Accept only 'en' / 'es' (case-insensitive; regional variants normalize). */
export function normalizeLocaleTag(value: unknown): LocaleTag | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v === 'en' || v.startsWith('en-') || v === 'en_us') return 'en';
  if (v === 'es' || v.startsWith('es-') || v === 'es_es') return 'es';
  return null;
}

export function toLocale(tag: LocaleTag): SupportedLocale {
  return LOCALE_BY_TAG[tag];
}

/** Best-effort BCP-47 parse of an Accept-Language header for supported tags. */
export function parseAcceptLanguage(header: unknown): LocaleTag | null {
  if (typeof header !== 'string' || !header.trim()) return null;
  const parts = header
    .split(',')
    .map((part) => {
      const [rawTag, ...params] = part.trim().split(';');
      let q = 1;
      for (const param of params) {
        const m = /^\s*q\s*=\s*([\d.]+)\s*$/.exec(param);
        if (m) {
          const parsed = Number.parseFloat(m[1]);
          if (Number.isFinite(parsed)) q = parsed;
        }
      }
      return { tag: rawTag.trim(), q };
    })
    .filter((p) => p.tag.length > 0)
    .sort((a, b) => b.q - a.q);
  for (const p of parts) {
    const tag = normalizeLocaleTag(p.tag);
    if (tag) return tag;
  }
  return null;
}

/** Read one cookie value from a raw Cookie header (pure, isomorphic). */
export function readCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export interface ServerLocaleInput {
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}

export interface LocaleResolution {
  locale: SupportedLocale;
  source: 'cookie' | 'accept-language' | 'default';
}

/** Pure server-side resolution: cookie → Accept-Language → en-US. */
export function resolveServerLocale(input: ServerLocaleInput): LocaleResolution {
  const fromCookie = normalizeLocaleTag(input.cookieLocale ?? null);
  if (fromCookie) return { locale: toLocale(fromCookie), source: 'cookie' };
  const fromHeader = parseAcceptLanguage(input.acceptLanguage ?? null);
  if (fromHeader) return { locale: toLocale(fromHeader), source: 'accept-language' };
  return { locale: DEFAULT_LOCALE, source: 'default' };
}

/** Client-side resolution used by beforeLoad on client navigations. */
export function resolveBrowserLocale(
  cookieHeader: string | null,
  languages: readonly string[],
): LocaleResolution {
  const fromCookie = normalizeLocaleTag(readCookieValue(cookieHeader, LOCALE_COOKIE));
  if (fromCookie) return { locale: toLocale(fromCookie), source: 'cookie' };
  for (const lang of languages) {
    const tag = normalizeLocaleTag(lang);
    if (tag) return { locale: toLocale(tag), source: 'accept-language' };
  }
  return { locale: DEFAULT_LOCALE, source: 'default' };
}

// ---------------------------------------------------------------------------
// Active locale (module-scoped by design in this iteration)
// ---------------------------------------------------------------------------
// Server: fixed per request in the root route's beforeLoad, before any
// component renders. Client: seeded from <html lang> rendered by SSR, which
// guarantees SSR and the first hydration agree (no flash, no mismatch).
// Known limitation (documented in docs/I18N_ARCHITECTURE.md): concurrent SSR
// requests share this slot (last-set-wins); a request-scoped store is planned
// for a later phase if traffic ever makes it relevant.

let activeLocale: SupportedLocale = DEFAULT_LOCALE;

if (typeof document !== 'undefined') {
  const seeded = normalizeLocaleTag(document.documentElement.lang);
  if (seeded) activeLocale = toLocale(seeded);
}

/** Fixed by the server for the whole request, or seeded on the client. */
export function setActiveLocale(locale: SupportedLocale): void {
  activeLocale = locale;
}

/** Locale used by t()/languageTag() for the current document. */
export function getActiveLocale(): SupportedLocale {
  return activeLocale;
}

/**
 * Persist the manual selection as a first-party cookie (no personal data):
 * client-writable (no HttpOnly), SameSite=Lax, Path=/, Secure in production,
 * value restricted to the normalized tags 'en' | 'es', duration 1 year.
 */
export function persistLocaleCookie(tag: LocaleTag): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    LOCALE_COOKIE + '=' + tag + '; Path=/; Max-Age=' + LOCALE_COOKIE_MAX_AGE + '; SameSite=Lax' + secure;
}
