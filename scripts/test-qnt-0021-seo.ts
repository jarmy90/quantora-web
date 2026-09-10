/**
 * QNT-0021 · Post-launch SEO / canonical domain contract tests.
 *
 *   bun run scripts/test-qnt-0021-seo.ts
 *
 * Verifies: the canonical site URL is the production domain; the root document
 * emits a per-route canonical link and Open Graph URL from the single site
 * module; robots.txt and sitemap.xml exist and only reference the canonical
 * host; the sitemap lists exactly the three published strategies while the
 * retired TM Bandas S3 and private/token routes stay out; no *.vercel.app or
 * localhost URLs leak into the public surface.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CANONICAL_SITE_URL, absoluteUrl, resolveSiteUrl, siteUrl } from '../src/site.ts';

const ROOT = resolve(import.meta.dir, '..');
const read = (p: string): string => readFileSync(resolve(ROOT, p), 'utf8');

const tests: { name: string; run: () => void }[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// 1. Canonical site URL module.
test('canonical site URL is the production domain', () => {
  assert(
    CANONICAL_SITE_URL === 'https://www.quantoramt5.com',
    `unexpected canonical site URL: ${CANONICAL_SITE_URL}`,
  );
});

test('site URL resolution keeps canonical default and strips trailing slashes', () => {
  assert(resolveSiteUrl(undefined) === CANONICAL_SITE_URL, 'missing env must fall back to canonical');
  assert(resolveSiteUrl('') === CANONICAL_SITE_URL, 'empty env must fall back to canonical');
  assert(resolveSiteUrl('https://example.com/') === 'https://example.com', 'trailing slash must be stripped');
});

test('absoluteUrl builds canonical absolute URLs for in-site paths', () => {
  assert(absoluteUrl('/') === `${CANONICAL_SITE_URL}/`, 'root path must resolve under the canonical host');
  assert(
    absoluteUrl('strategies') === `${CANONICAL_SITE_URL}/strategies`,
    'path without leading slash must be normalized',
  );
});

test('resolved site URL never lands on localhost or vercel.app', () => {
  const url = siteUrl();
  assert(!url.includes('localhost'), 'site URL must not be localhost');
  assert(!url.includes('vercel.app'), 'site URL must not be a vercel.app domain');
});

// 2. Root document emits canonical + OG per route.
test('root document emits canonical link and og:url from the site module', () => {
  const root = read('src/routes/__root.tsx');
  assert(root.includes('rel="canonical"'), 'canonical link missing');
  assert(root.includes('"og:url"'), 'og:url missing');
  assert(root.includes('absoluteUrl('), 'canonical must come from the site module');
  assert(root.includes('useLocation().pathname'), 'canonical must follow the current route path');
});

// 3. robots.txt.
test('robots.txt allows crawling and references the canonical sitemap', () => {
  const robots = read('public/robots.txt');
  assert(robots.includes('User-agent: *'), 'robots must target all user agents');
  assert(robots.includes('Allow: /'), 'robots must allow the public site');
  assert(robots.includes('Disallow: /account'), 'private account area must be disallowed');
  assert(robots.includes(`Sitemap: ${CANONICAL_SITE_URL}/sitemap.xml`), 'sitemap must be absolute and canonical');
  assert(!robots.includes('vercel.app') && !robots.includes('localhost'), 'robots must not reference technical hosts');
});

// 4. sitemap.xml.
const PUBLISHED_IDS = ['first-triangle-adaptive', 'first-triangle-gold-adaptive', 'stochextreme-adaptive'];

test('sitemap lists exactly the public surface with canonical URLs', () => {
  const sitemap = read('public/sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert(locs.length > 0, 'sitemap must contain URLs');
  const expected = [
    `${CANONICAL_SITE_URL}/`,
    `${CANONICAL_SITE_URL}/strategies`,
    `${CANONICAL_SITE_URL}/how-to-install`,
    ...PUBLISHED_IDS.map((id) => `${CANONICAL_SITE_URL}/strategies/${id}`),
    `${CANONICAL_SITE_URL}/login`,
    `${CANONICAL_SITE_URL}/register`,
    `${CANONICAL_SITE_URL}/forgot-password`,
    `${CANONICAL_SITE_URL}/legal/terms`,
    `${CANONICAL_SITE_URL}/legal/privacy`,
    `${CANONICAL_SITE_URL}/legal/risk-disclosure`,
    `${CANONICAL_SITE_URL}/legal/disclaimer`,
  ].sort();
  assert(
    JSON.stringify([...locs].sort()) === JSON.stringify(expected),
    `sitemap URLs mismatch: ${locs.join(', ')}`,
  );
});

test('sitemap excludes the retired strategy and private or token routes', () => {
  const sitemap = read('public/sitemap.xml');
  assert(!sitemap.includes('tm-bandas'), 'retired TM Bandas S3 must not appear in the sitemap');
  assert(!sitemap.includes('/account'), 'private account route must not appear in the sitemap');
  assert(!sitemap.includes('/dashboard'), 'private dashboard route must not appear in the sitemap');
  assert(
    !sitemap.includes('/reset-password') && !sitemap.includes('/auth/callback'),
    'token-based routes must not appear in the sitemap',
  );
});

// 5. No technical hosts leak into the public SEO surface.
test('public SEO surface does not reference vercel.app or localhost', () => {
  const files = ['src/site.ts', 'src/routes/__root.tsx', 'public/robots.txt', 'public/sitemap.xml'];
  for (const file of files) {
    const content = read(file);
    assert(!content.includes('.vercel.app'), `${file} must not reference vercel.app`);
    assert(!/localhost:\d+/.test(content), `${file} must not reference localhost URLs`);
  }
});

let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    t.run();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`✗ ${t.name}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`Tests executed: ${tests.length} | passed: ${passed} | failed: ${failed}`);
if (failed > 0) throw new Error(`${failed} test(s) failed`);
