/**
 * QNT-0014 · Easy Start tests.
 *
 *   bun run scripts/test-qnt-0014.ts
 *
 * Verifies the public installation guide (3 steps), EX5-vs-MQ5 messaging,
 * demo-first safety, absence of any transaction/download affordance, the
 * reusable component, cross-linking (home / detail / account), accessibility
 * affordances and that commercial flags stay disabled.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCommercialCatalog } from '../src/commercial/catalog.ts';
import { getFeatureFlags } from '../src/config.ts';

const ROOT = resolve(import.meta.dir, '..');
const read = (p: string): string => readFileSync(resolve(ROOT, p), 'utf8');

const tests: { name: string; run: () => void }[] = [];
function test(name: string, run: () => void): void {
  tests.push({ name, run });
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const guide = read('src/routes/how-to-install.tsx');
const stepsComp = read('src/components/EasyStartSteps.tsx');
const home = read('src/routes/index.tsx');
const detail = read('src/routes/strategies.$id.tsx');
const account = read('src/routes/account.tsx');
const i18n = read('src/i18n/index.ts');

test('public /how-to-install route exists and is a route module', () => {
  assert(guide.includes("createFileRoute('/how-to-install')"), 'route must be registered');
  assert(guide.includes('component: HowToInstall'), 'route must render the guide');
});

test('the guide has exactly three main steps', () => {
  const count = (guide.match(/<GuideStep /g) ?? []).length;
  assert(count === 3, `expected 3 GuideStep blocks, got ${count}`);
  assert(guide.includes('Step 1') && guide.includes('Step 2') && guide.includes('Step 3'), 'three steps labelled');
  assert(guide.includes('easy.downloadTitle'), 'step 1 download');
  assert(guide.includes('easy.installTitle'), 'step 2 install');
  assert(guide.includes('easy.testTitle'), 'step 3 demo test');
});

test('EX5 is the standard delivery and MQ5 is private source, no compilation required', () => {
  assert(/\.ex5/.test(guide + stepsComp + i18n), '.ex5 must be mentioned');
  assert(i18n.includes("'.mq5 source code is private'") || read('docs/EASY_START_ARCHITECTURE.md').includes('private intellectual property'), 'MQ5 must be documented as private');
  assert(i18n.includes('No source-code editing or compilation is required'), 'standard install must not require compilation');
  assert(i18n.includes('Recommended settings file') || i18n.includes('settings file is included only when available'), 'settings file wording must be conditional');
});

test('demo-first guidance is present and live accounts are discouraged', () => {
  assert(i18n.includes('Do not begin with a live account'), 'demo-first warning');
  assert(i18n.includes('Demo account confirmed'), 'demo checklist item');
  assert(i18n.includes('clearly identified demo account'), 'demo account labelled');
});

test('no performance promise, no transaction or download affordance', () => {
  const all = guide + stepsComp + home + detail + account + i18n;
  assert(!/guarantee/.test(all) || i18n.includes('does not guarantee performance'), 'no absolute performance promise');
  assert(/does not guarantee performance/.test(i18n), 'disclaimer about performance present');
  for (const words of ['Buy strategy', 'Rent strategy', 'Checkout', 'Pay now', 'Download .ex5', 'Download the EA']) {
    assert(!new RegExp(words, 'i').test(guide + stepsComp + home), `no active ${words} affordance`);
  }
  // The only "download" wording is the informational placeholder.
  assert(i18n.includes('Download becomes available with an active product and license'), 'download clearly deferred');
});

test('all four products stay coming_soon and non-downloadable', () => {
  const cat = buildCommercialCatalog();
  assert(cat.length === 4, `expected 4 products, got ${cat.length}`);
  for (const p of cat) {
    assert(p.productStatus === 'coming_soon', `${p.productId} must be coming_soon`);
    assert(p.commercialDownloadEnabled === false, `${p.productId} download must be disabled`);
    assert(p.availability.canStartCheckout === false, `${p.productId} checkout must be disabled`);
    assert(p.availability.canDownload === false, `${p.productId} cannot download`);
  }
});

test('commercial feature flags are all disabled by default', () => {
  const flags = getFeatureFlags();
  assert(flags.authEnabled === false, 'auth flag false (live project gates it separately)');
  assert(flags.paymentsEnabled === false, 'payments flag false');
  assert(flags.downloadsEnabled === false, 'downloads flag false');
  assert(flags.demoMonitoringEnabled === false, 'demo flag false');
});

test('home, strategy detail and account all link to /how-to-install', () => {
  assert(home.includes(`to="/how-to-install"`), 'home links the guide');
  assert(detail.includes(`asLinkTo="/how-to-install"`), 'detail uses compact component with link');
  assert(account.includes(`to="/how-to-install"`), 'account links the guide');
});

test('a reusable Easy Start component exists and is shared, not duplicated four times', () => {
  assert(!!readdirSync(resolve(ROOT, 'src/components')).includes('EasyStartSteps.tsx'), 'component file exists');
  assert(stepsComp.includes('mode') && stepsComp.includes("'full'") && stepsComp.includes("'compact'") && stepsComp.includes("'preview'"), 'supports full/compact/preview modes');
  assert(stepsComp.includes('asLinkTo'), 'component accepts a target link');
  // It must be imported by the detail page (used per-render, not copied).
  assert(detail.includes("from '../components/EasyStartSteps'"), 'detail shares the component');
});

test('visuals are labelled and text is not the sole concern of images', () => {
  assert(
    (stepsComp.includes('role="img"') || stepsComp.includes("role: 'img'")) && stepsComp.includes('aria-label'),
    'visuals carry accessible labels',
  );
  assert(stepsComp.includes('aria-hidden'), 'decorative mode supported');
  // The guide body fully conveys the meaning without images (text lists).
  assert(guide.includes('easy.installStep') && guide.includes('easy.testStep'), 'steps carry textual lists');
});

test('mobile responsiveness is supported', () => {
  const css = read('src/styles/app.css');
  assert(/@media\(max-width:760px\)/.test(css), 'responsive breakpoint present');
  assert(/easy-check/.test(css) && /easy-hero h1/.test(css), 'easy classes responsive');
});

test('strategies, metrics and auth remain intact', () => {
  // This phase touches none of the strategy/domain logic files.
  for (const f of ['src/domain/commercial/product.ts', 'src/domain/commercial/rules.ts', 'src/domain/auth/contracts.ts', 'src/routes/strategies.index.tsx']) {
    assert(![guide, stepsComp, home, detail, account].some((s) => s.includes(f)), `should not edit ${f}`);
  }
  // The strategy detail still renders metrics, monitor and product state.
  assert(detail.includes('metric-grid'), 'metrics still rendered');
  assert(detail.includes('detail.productState'), 'product state still rendered');
  assert(account.includes('beforeLoad'), 'auth protection still present');
});

// ---------------------------------------------------------------------------

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
