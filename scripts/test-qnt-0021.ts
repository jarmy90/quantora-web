import fs from 'fs';
import path from 'path';
import { publicStrategies } from '../src/catalog';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

console.log('--- Testing QNT-0021 Hito A Contract & Principles ---');

const navContent = fs.readFileSync(path.join(process.cwd(), 'src/components/Nav.tsx'), 'utf8');
const footerContent = fs.readFileSync(path.join(process.cwd(), 'src/components/Footer.tsx'), 'utf8');
const homeContent = fs.readFileSync(path.join(process.cwd(), 'src/routes/index.tsx'), 'utf8');
const i18nContent = fs.readFileSync(path.join(process.cwd(), 'src/i18n/index.ts'), 'utf8');
const cssContent = fs.readFileSync(path.join(process.cwd(), 'src/styles/app.css'), 'utf8');
const pkgContent = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');

// 1. Public navigation without mock Dashboard link
assert(!navContent.includes("to=\"/dashboard\""), 'Nav should not include mock Dashboard link');

// 2. Strategies appears in nav
assert(navContent.includes("to=\"/strategies\""), 'Nav should contain Strategies link');

// 3. How to install is present in nav
assert(navContent.includes("to=\"/how-to-install\""), 'Nav should contain How to install link');

// 4. Sign in is present in nav
assert(navContent.includes("to=\"/login\""), 'Nav should contain Sign in link');

// 5. Create account is present in nav and points to /register
assert(navContent.includes("to=\"/register\""), 'Nav should contain Create account link pointing to /register');

// 6. MOCK ENVIRONMENT does not appear in header
assert(!navContent.includes("MOCK ENVIRONMENT"), 'Nav should not contain MOCK ENVIRONMENT string');

// 7. Footer without Demo experience
assert(!footerContent.includes("Demo experience"), 'Footer should not contain Demo experience string');

// 8. Footer without global legal placeholder notice
assert(!footerContent.includes("legal pages are placeholders"), 'Footer should not contain legal placeholder string');

// 9. Hero mentions Expert Advisors
assert(i18nContent.includes("Expert Advisors"), 'i18n should include Expert Advisors in Hero text');

// 10. Hero contains no unverified claims
assert(!i18nContent.toLowerCase().includes("best strategy"), 'Hero should not contain "best strategy"');
assert(!i18nContent.toLowerCase().includes("number one"), 'Hero should not contain "number one"');
assert(!i18nContent.toLowerCase().includes("guaranteed return"), 'Hero should not contain "guaranteed return"');

// 11. CTAs point to real functional routes
assert(homeContent.includes("to=\"/strategies\""), 'Hero CTA should point to /strategies');
assert(homeContent.includes("to=\"/register\""), 'Hero CTA should point to /register');
assert(homeContent.includes("to=\"/how-to-install\""), 'Easy Installation CTA should point to /how-to-install');

// 12. 4 published strategies continue to be rendered
assert(publicStrategies.length === 4, 'Should have exactly 4 published strategies');

// 13. No metrics or manifests modified
const manifestCount = fs.readdirSync(path.join(process.cwd(), 'public-strategies/manifests')).filter(f => f.endsWith('.json')).length;
assert(manifestCount === 4, 'Should preserve exactly 4 manifest files');

// 14. Payments not enabled
assert(!homeContent.includes("PAYMENTS_ENABLED = true"), 'Payments should not be enabled on home page');

// 15. Downloads not enabled
assert(!homeContent.includes("DOWNLOADS_ENABLED = true"), 'Downloads should not be enabled on home page');

// 16. Demo monitoring not enabled
assert(!homeContent.includes("DEMO_MONITORING_ENABLED = true"), 'Demo monitoring should not be enabled on home page');

// 17. Support for prefers-reduced-motion exists in CSS
assert(cssContent.includes("prefers-reduced-motion"), 'app.css must contain prefers-reduced-motion support');

// 18. Mobile menu supports keyboard/outside click handling
assert(navContent.includes("Escape"), 'Mobile menu must support Escape key');
assert(navContent.includes("mousedown"), 'Mobile menu must support click outside handler');

// 19. No invented prices
assert(!homeContent.includes("$99/mo"), 'Home page must not contain fake pricing');

// 20. No unnecessary dependencies added
const pkg = JSON.parse(pkgContent);
assert(!pkg.dependencies.tailwindcss, 'Tailwind should not be added as a runtime dependency');

console.log('✅ ALL 20 CONTRACT CHECKS PASSED SUCCESSFULLY for QNT-0021 Hito A!');

