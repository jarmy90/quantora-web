/**
 * QNT launch · Canonical public site URL.
 *
 * Single source of truth for every absolute URL emitted by the app
 * (canonical links, Open Graph, sitemap, robots). Defaults to the canonical
 * production domain so SEO metadata stays canonical even on previews.
 * VITE_SITE_URL (when configured) overrides it for other environments.
 * Import-safe in server and client bundles; contains no secrets.
 */
export const CANONICAL_SITE_URL = 'https://www.quantoramt5.com';

/** Normalizes a raw base URL: trims whitespace and trailing slashes. */
export function resolveSiteUrl(raw: string | undefined | null): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  return value.length > 0 ? value : CANONICAL_SITE_URL;
}

/** VITE_SITE_URL when configured, otherwise the canonical production URL. */
export function siteUrl(): string {
  let raw: string | undefined;
  try {
    raw = import.meta.env?.VITE_SITE_URL as string | undefined;
  } catch {
    raw = undefined;
  }
  return resolveSiteUrl(raw);
}

/** Absolute canonical URL for an in-site path (query strings excluded). */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}