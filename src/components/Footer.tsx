import { Link } from '@tanstack/react-router';
import { Logo } from './Logo';
import { t } from '../i18n';

/**
 * Global site footer. Reuses the Quantora logo, links to primary sections,
 * account routes, and legal disclaimers. Keeps risk disclosures and clear
 * non-financial advice notices visible on every page.
 */
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Logo />
          <p className="muted footer-tagline">{t('footer.tagline')}</p>
          <p className="mono footer-demo">{t('footer.demo')}</p>
        </div>
        <div className="footer-col">
          <h4>{t('footer.product')}</h4>
          <Link to="/strategies">{t('nav.strategies')}</Link>
          <Link to="/strategies">{t('home.compare')}</Link>
          <Link to="/how-to-install">{t('nav.install')}</Link>
          <Link to="/register">{t('nav.createAccount')}</Link>
        </div>
        <div className="footer-col">
          <h4>{t('footer.account')}</h4>
          <Link to="/login">{t('nav.signIn')}</Link>
          <Link to="/account">{t('nav.myAccount')}</Link>
        </div>
        <div className="footer-col">
          <h4>{t('footer.legal')}</h4>
          <Link to="/legal/disclaimer">{t('footer.legalDisclaimer')}</Link>
          <Link to="/legal/terms">{t('footer.legalTerms')}</Link>
          <Link to="/legal/privacy">{t('footer.legalPrivacy')}</Link>
          <Link to="/legal/risk-disclosure">{t('footer.legalRisk')}</Link>
        </div>
      </div>
      <div className="wrap footer-bar">
        <span>© 2026 Quantora.io</span>
        <span className="mono">{t('footer.rights')}</span>
      </div>
    </footer>
  );
}
