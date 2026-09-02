import { Link } from '@tanstack/react-router';
import { Logo } from './Logo';
import { t } from '../i18n';

/**
 * Global site footer. Reuses the Quantora logo, links to primary sections and
 * the placeholder legal pages, and keeps the demo / not-financial-advice notice
 * visible on every page.
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
          <Link to="/how-to-install">{t('nav.install')}</Link>
          <Link to="/dashboard">{t('nav.dashboard')}</Link>
        </div>
        <div className="footer-col">
          <h4>{t('footer.legal')}</h4>
          <Link to="/legal/disclaimer">{t('footer.legalDisclaimer')}</Link>
          <Link to="/legal/terms">{t('footer.legalTerms')}</Link>
          <Link to="/legal/privacy">{t('footer.legalPrivacy')}</Link>
          <Link to="/legal/risk-disclosure">{t('footer.legalRisk')}</Link>
          <span className="footer-review">{t('footer.legalReview')}</span>
        </div>
      </div>
      <div className="wrap footer-bar">
        <span>© 2026 Quantora.io</span>
        <span className="mono">{t('footer.rights')}</span>
      </div>
    </footer>
  );
}
