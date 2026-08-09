import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { t } from '../i18n';

/**
 * Global site header. Renders the Quantora logo, primary navigation and a
 * persistent "mock environment" badge so every page is clearly a demo.
 * `extra` allows pages (e.g. the landing page) to add in-page anchor links.
 */
export function Nav({ extra }: { extra?: ReactNode }) {
  return (
    <header className="wrap">
      <nav className="nav">
        <Logo />
        <div className="links">
          <Link to="/">{t('nav.home')}</Link>
          <Link to="/strategies">{t('nav.strategies')}</Link>
          <Link to="/dashboard">{t('nav.dashboard')}</Link>
          {extra}
        </div>
        <div className="nav-actions">
          <span className="badge nav-badge">{t('nav.mockEnvironment')}</span>
          <Link className="btn primary" to="/strategies">
            {t('nav.explore')}
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function CatalogNav() {
  return (
    <header className="wrap">
      <nav className="nav">
        <Logo />
        <div className="links">
          <Link to="/">{t('nav.home')}</Link>
          <Link to="/dashboard">{t('nav.dashboard')}</Link>
        </div>
        <span className="badge nav-badge">{t('nav.mockEnvironment')}</span>
      </nav>
    </header>
  );
}
