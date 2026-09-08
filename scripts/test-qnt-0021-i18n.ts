/**
 * QNT-0021-I18N · Contractual tests for the English/Spanish localization.
 *
 * Run with: bun run scripts/test-qnt-0021-i18n.ts
 *
 * Mirrors the QNT-0021-I18N acceptance criteria:
 *  1. supported locales en/es
 *  2. safe fallback to English (base locale)
 *  3. normalization of es-* and en-* regional variants
 *  4. unsupported languages → English
 *  5. exact key parity between the en-US catalog and es-ES
 *  6. no extra keys in es-ES
 *  7. no undefined/null/empty translations
 *  8. `{placeholder}` tokens preserved 1:1 between languages
 *  9. EN/ES manual selector present in the navigation
 * 10. manual selection persisted in a safe cookie (SameSite=Lax, Path=/, no HttpOnly)
 * 11. `<html lang>` bound to the resolved active locale
 * 12. no IP/country geolocation
 * 13. SSR-safe browser access (no window/document/navigator on the server)
 * 14. strategy metrics and catalog manifests are not modified
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { enUS, languageTag, t } from '../src/i18n';
import { esES } from '../src/i18n/es-ES';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  SUPPORTED_TAGS,
  htmlLangForLocale,
  normalizeLocaleTag,
  parseAcceptLanguage,
  resolveBrowserLocale,
  resolveServerLocale,
  setActiveLocale,
} from '../src/i18n/locale';

let failures = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    failures += 1;
    console.error(`❌ FAIL: ${message}`);
  }
}

function check(name: string, fn: () => void): void {
  const before = failures;
  try {
    fn();
  } catch (error) {
    failures += 1;
    console.error(`❌ FAIL (threw): ${name} — ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log(`${failures === before ? '✅' : '❌'} ${name}`);
}

function readText(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

function placeholders(value: string): string[] {
  const found: string[] = [];
  for (const m of value.matchAll(/\{([a-z0-9_]+)\}/gi)) found.push(m[1]);
  return found.sort();
}

console.log('--- QNT-0021-I18N contract tests ---');

// 1. Supported locales are exactly en and es.
check('1. supported locales are en and es', () => {
  assert(
    JSON.stringify(SUPPORTED_TAGS) === JSON.stringify(['en', 'es']),
    `SUPPORTED_TAGS must be ["en","es"], got ${JSON.stringify(SUPPORTED_TAGS)}`,
  );
  assert(normalizeLocaleTag('en') === 'en', 'bare en must normalize to en');
  assert(normalizeLocaleTag('es') === 'es', 'bare es must normalize to es');
});

// 2. Safe fallback to English.
check('2. fallback to English', () => {
  assert(resolveServerLocale({}).locale === DEFAULT_LOCALE, 'server: empty input must fall back to en-US');
  assert(resolveBrowserLocale(null, []).locale === DEFAULT_LOCALE, 'client: empty input must fall back to en-US');
  assert(resolveServerLocale({ acceptLanguage: 'fr' }).locale === DEFAULT_LOCALE, 'fr header must fall back to en');
  assert(resolveBrowserLocale(null, ['fr']).locale === DEFAULT_LOCALE, 'fr browser language must fall back to en');
});

// 3. Regional variant normalization.
check('3. normalization of es-* and en-* variants', () => {
  for (const v of ['es', 'es-ES', 'es-MX', 'es-AR', 'es_es']) {
    assert(normalizeLocaleTag(v) === 'es', `${v} must normalize to es`);
  }
  for (const v of ['en', 'en-US', 'en-GB', 'en-CA', 'en_us']) {
    assert(normalizeLocaleTag(v) === 'en', `${v} must normalize to en`);
  }
  assert(parseAcceptLanguage('es-ES,es;q=0.9,en;q=0.8') === 'es', 'es-ES first must resolve to es');
  assert(parseAcceptLanguage('en-US;q=0.9,es-ES;q=0.8') === 'en', 'higher en q-value must win');
});

// 4. Unsupported languages → English.
check('4. unsupported languages resolve to en', () => {
  for (const v of ['fr', 'de', 'ja', 'zh', 'pt', 'ru', 'it']) {
    assert(normalizeLocaleTag(v) === null, `${v} must not be supported`);
  }
  assert(normalizeLocaleTag('') === null, 'empty string must not be supported');
  assert(normalizeLocaleTag(undefined) === null, 'undefined must not be supported');
  assert(resolveServerLocale({ acceptLanguage: 'de,fr;q=0.9' }).locale === DEFAULT_LOCALE, 'de must fall back to en');
});

// 5/6. Exact key parity and no extra keys in Spanish.
const enKeys = Object.keys(enUS).sort();
const esKeys = Object.keys(esES).sort();

check('5. exact key parity (en ↔ es)', () => {
  assert(enKeys.length === esKeys.length, `key count mismatch: en=${enKeys.length} es=${esKeys.length}`);
  const missing = enKeys.filter((k) => !(k in esES));
  assert(missing.length === 0, `es missing keys: ${missing.join(', ')}`);
});

check('6. no additional keys in es-ES', () => {
  const extra = esKeys.filter((k) => !(k in enUS));
  assert(extra.length === 0, `extra es keys: ${extra.join(', ')}`);
});

// 7. No empty/missing/undefined translations.
check('7. no empty, null or undefined translations', () => {
  for (const [key, value] of Object.entries(esES)) {
    assert(typeof value === 'string' && value.trim().length > 0, `${key} must be a non-empty string`);
    assert(!value.includes('TODO-ES'), `${key} must not be a TODO placeholder`);
  }
  for (const value of Object.values(enUS)) {
    assert(typeof value === 'string' && value.trim().length > 0, 'en value must be a non-empty string');
  }
});

// 8. Placeholder/interpolation parity.
check('8. placeholders preserved 1:1', () => {
  for (const key of enKeys) {
    const enKey = key as keyof typeof enUS;
    assert(
      JSON.stringify(placeholders(esES[key])) === JSON.stringify(placeholders(enUS[enKey])),
      `${key} placeholder mismatch: "${esES[key]}" vs "${enUS[enKey]}"`,
    );
  }
});

// 9. EN/ES manual selector present in the navigation.
check('9. EN/ES selector in navigation', () => {
  const nav = readText('src/components/Nav.tsx');
  assert(nav.includes('lang-switch'), 'Nav must render a .lang-switch group');
  assert(nav.includes('aria-pressed'), 'selector buttons must expose aria-pressed state');
  assert(
    nav.includes('aria-label="English"') && nav.includes('aria-label="Spanish"'),
    'buttons must carry accessible names',
  );
  assert(nav.includes('EN'), 'EN option must be present');
  assert(nav.includes('ES'), 'ES option must be present');
});

// 10. Persisted manual selection (cookie contract).
check('10. persistent manual selection (safe cookie)', () => {
  const localeSrc = readText('src/i18n/locale.ts');
  assert(LOCALE_COOKIE === 'quantora_locale', 'cookie name must be the stable, documented value');
  assert(localeSrc.includes('SameSite=Lax'), 'cookie must be SameSite=Lax');
  assert(localeSrc.includes('Path=/'), 'cookie must be Path=/');
  assert(localeSrc.includes('Max-Age='), 'cookie must carry a Max-Age (duration)');
  assert(localeSrc.includes('LOCALE_COOKIE_MAX_AGE'), 'the declared duration constant must be applied to the cookie');
  assert(LOCALE_COOKIE_MAX_AGE >= 60 * 60 * 24 * 365, 'duration must be at least one year');
  const persistBody = localeSrc.slice(localeSrc.indexOf('export function persistLocaleCookie'));
  assert(!persistBody.includes('HttpOnly'), 'the selector cookie itself must NOT be set with HttpOnly');
  const nav = readText('src/components/Nav.tsx');
  assert(nav.includes('persistLocaleCookie'), 'selector must write the persisted cookie');
});

// 11. <html lang> connected to the resolved locale.
check('11. html lang bound to resolved locale', () => {
  const root = readText('src/routes/__root.tsx');
  assert(root.includes('htmlLangForLocale'), 'root must compute the html lang from the active locale');
  assert(root.includes('lang={'), 'root html element must use a dynamic lang attribute');
  assert(root.includes('setActiveLocale'), 'root must apply the resolved locale before rendering');
  assert(
    root.includes('resolveLocaleForRequest') || root.includes('resolveServerLocale'),
    'root must resolve the locale on the server',
  );
  assert(
    htmlLangForLocale('en-US') === 'en' && htmlLangForLocale('es-ES') === 'es',
    'en-US→en and es-ES→es mapping is mandatory',
  );
});

// 12. No IP/country geolocation (real mechanisms, not prose).
check('12. no IP/country geolocation', () => {
  // Detection targets actual lookup mechanisms; textbook words such as
  // "geolocation" in a prohibition comment are not a violation.
  const heuristicCall = /navigator\.geolocation|ip-?api|geoip|freegeoip|ipinfo|maxmind|api\.ipify|ipgeolocation\.[a-z]+/gi;
  const remoteLookup = /(?:fetch|axios|httpRequest|get)\s*\(\s*["'`][^"'`]*(?:ipapi|ipify|geoip|ipinfo|ip-api)/gi;
  for (const file of [
    'src/i18n/index.ts',
    'src/i18n/locale.ts',
    'src/i18n/server.ts',
    'src/routes/__root.tsx',
    'src/components/Nav.tsx',
  ]) {
    const src = readText(file);
    assert(!heuristicCall.test(src), `${file} must not call an IP/geolocation provider`);
    assert(!remoteLookup.test(src), `${file} must not fetch an IP/geolocation service`);
  }
});

// 13. SSR-safe access to browser globals.
check('13. SSR-safe browser access', () => {
  const localeSrc = readText('src/i18n/locale.ts');
  assert(localeSrc.includes("typeof document === 'undefined'"), 'browser-dependent code must guard document access');
  const server = readText('src/i18n/server.ts');
  assert(server.includes('getRequest'), 'server resolution must use the request context');
  assert(!server.includes('document.') && !server.includes('navigator.'), 'server module must not touch browser globals');
});

// 14. Strategy data and metrics are untouched.
check('14. strategy data and catalog untouched', () => {
  const status = execFileSync(
    'git',
    ['status', '--porcelain', '--', 'public-strategies', 'src/catalog.ts'],
    { encoding: 'utf8' },
  ).trim();
  assert(status.length === 0, `strategy data must not be modified: ${status || '(none)'}`);
});

// 15. t()/languageTag() follow the active locale.
check('15. t() and languageTag() follow the active locale', () => {
  setActiveLocale('es-ES');
  assert(languageTag() === 'es-ES', 'languageTag must reflect the active Spanish locale');
  assert(t('nav.home') === esES['nav.home'] && t('nav.home') !== 'Home', 't() must return the Spanish value for nav.home');
  assert(t('detail.evidenceConfidence') === esES['detail.evidenceConfidence'], 'interpolated key must come from es-ES');
  setActiveLocale('en-US');
  assert(languageTag() === 'en-US' && t('nav.home') === 'Home', 't() must return English again after switching back');
});

console.log(`\nQNT-0021-I18N: ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} check(s) FAILED`}`);
if (failures > 0) process.exitCode = 1;