import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Logo } from './Logo';
import { t } from '../i18n';

/**
 * Global site header. Renders the Quantora logo, primary navigation and a
 * persistent "mock environment" badge so every page is clearly a demo.
 * `extra` allows pages (e.g. the landing page) to add in-page anchor links.
 */
export function Nav({ extra }: { extra?: ReactNode }) {
  return (
    <header className="wrap site-header">
      <nav className="nav" aria-label="Primary">
        <Logo />
        <div className="links">
          <Link to="/">{t('nav.home')}</Link>
          <Link to="/strategies">{t('nav.strategies')}</Link>
          <Link to="/how-to-install">{t('nav.install')}</Link>
          <Link to="/dashboard">{t('nav.dashboard')}</Link>
          <Link to="/login">{t('nav.signIn')}</Link>
          {extra}
        </div>
        <div className="nav-actions">
          {!import.meta.env.PROD && (
            <span className="badge nav-badge">{t('nav.mockEnvironment')}</span>
          )}
          <Link className="btn primary nav-explore" to="/strategies">
            {t('nav.explore')}
          </Link>
          <MobileMenu extra={extra} />
        </div>
      </nav>
    </header>
  );
}

export function CatalogNav() {
  return (
    <header className="wrap site-header">
      <nav className="nav" aria-label="Primary">
        <Logo />
        <div className="links">
          <Link to="/">{t('nav.home')}</Link>
          <Link to="/how-to-install">{t('nav.install')}</Link>
          <Link to="/dashboard">{t('nav.dashboard')}</Link>
        </div>
        <div className="nav-actions">
          {!import.meta.env.PROD && (
            <span className="badge nav-badge">{t('nav.mockEnvironment')}</span>
          )}
          <MobileMenu />
        </div>
      </nav>
    </header>
  );
}

/**
 * Accessible mobile navigation. Hidden on desktop; on small viewports it
 * replaces the header links with a toggle + panel. Closes on Escape, on
 * navigation, on the close button and on outside clicks.
 */
function MobileMenu({ extra }: { extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        toggleRef.current &&
        !toggleRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="nav-toggle"
        aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="nav-toggle-bar" />
        <span className="nav-toggle-bar" />
        <span className="nav-toggle-bar" />
      </button>
      {open && (
        <div
          id="mobile-menu"
          className="mobile-menu"
          ref={panelRef}
          aria-label="Navigation"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a, button')) close();
          }}
        >
          <Link to="/">{t('nav.home')}</Link>
          <Link to="/strategies">{t('nav.strategies')}</Link>
          <Link to="/how-to-install">{t('nav.install')}</Link>
          <Link to="/dashboard">{t('nav.dashboard')}</Link>
          <Link to="/login">{t('nav.signIn')}</Link>
          {extra}
        </div>
      )}
    </>
  );
}
