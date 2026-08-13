import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { t } from '../i18n';

const primaryLinks = [
  { to: '/', label: t('nav.home') },
  { to: '/strategies', label: 'Browse' },
  { to: '/matcher', label: t('nav.matcher') },
  { to: '/compare', label: 'Compare' },
  { to: '/publish', label: t('nav.publish') },
  { to: '/creator', label: t('nav.creator') },
  { to: '/dashboard', label: t('nav.dashboard') },
] as const;

/**
 * Global navigation. The compact menu is intentionally a real button + nav:
 * it supports Escape, returns focus to its trigger, locks document scroll, and
 * closes after selecting a route. The logo remains the reliable Home link at
 * every breakpoint.
 */
export function Nav({ extra }: { extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstLinkRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <header className="wrap nav-wrap">
      <nav className="nav" aria-label="Primary navigation">
        <Logo />
        <div className="links nav-links-desktop">
          {primaryLinks.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
          {extra}
        </div>
        <div className="nav-actions">
          <span className="badge nav-badge">{t('nav.mockEnvironment')}</span>
          <Link className="btn primary" to="/strategies">
            {t('nav.explore')}
          </Link>
          <button
            ref={triggerRef}
            className="nav-menu-trigger"
            type="button"
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            aria-controls="quantora-mobile-navigation"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true" className="nav-menu-icon">{open ? '×' : '☰'}</span>
            <span className="sr-only">{open ? 'Close navigation menu' : 'Open navigation menu'}</span>
          </button>
        </div>
      </nav>
      <div
        id="quantora-mobile-navigation"
        className={`mobile-nav-panel ${open ? 'is-open' : ''}`}
        hidden={!open}
      >
        <div className="mobile-nav-links">
          {primaryLinks.map((link, index) => (
            <Link
              key={link.to}
              to={link.to}
              ref={index === 0 ? firstLinkRef : undefined}
              onClick={closeMenu}
            >
              {link.label}
            </Link>
          ))}
          {extra && <div className="mobile-nav-extra" onClick={closeMenu}>{extra}</div>}
        </div>
        <div className="mobile-nav-footer">
          <span className="badge nav-badge">{t('nav.mockEnvironment')}</span>
          <Link className="btn primary" to="/strategies" onClick={closeMenu}>
            {t('nav.explore')}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** The catalog uses the same route-complete, accessible mobile navigation. */
export function CatalogNav() {
  return <Nav />;
}
