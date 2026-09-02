import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Logo } from './Logo';
import { t } from '../i18n';
import { getAuthStatus, signOut } from '../domain/auth/server';

type AuthState = 'loading' | 'guest' | 'user';

/**
 * Global site header. Renders the Quantora logo, primary navigation and an
 * account area: "My account" + "Sign out" for signed-in visitors, or
 * "Sign in" + a primary "Create account" CTA for everyone else. The mock
 * dashboard is not promoted as a primary destination while it remains a
 * preview.
 */
export function Nav({ extra }: { extra?: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>('loading');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const status = await getAuthStatus();
        if (!cancelled) setAuth(status.user ? 'user' : 'guest');
      } catch {
        if (!cancelled) setAuth('guest');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    window.location.href = '/';
  }

  return (
    <header className="wrap site-header">
      <nav className="nav" aria-label="Primary">
        <Logo />
        <div className="links">
          <Link to="/">{t('nav.home')}</Link>
          <Link to="/strategies">{t('nav.strategies')}</Link>
          <Link to="/how-to-install">{t('nav.install')}</Link>
          {auth === 'user' ? (
            <Link to="/account">{t('nav.myAccount')}</Link>
          ) : (
            <Link to="/login">{t('nav.signIn')}</Link>
          )}
          {extra}
        </div>
        <div className="nav-actions">
          {!import.meta.env.PROD && (
            <span className="badge nav-badge">{t('nav.mockEnvironment')}</span>
          )}
          {auth === 'user' ? (
            <button type="button" className="btn nav-explore" onClick={handleSignOut}>
              {t('account.signOut')}
            </button>
          ) : (
            <Link className="btn primary nav-explore" to="/register">
              {t('nav.createAccount')}
            </Link>
          )}
          <MobileMenu auth={auth} onSignOut={handleSignOut} extra={extra} />
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
        </div>
        <div className="nav-actions">
          <Link className="btn primary nav-explore" to="/register">
            {t('nav.createAccount')}
          </Link>
          <MobileMenu auth="guest" onSignOut={async () => undefined} />
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
function MobileMenu({
  auth,
  onSignOut,
  extra,
}: {
  auth: AuthState;
  onSignOut: () => void;
  extra?: ReactNode;
}) {
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
          {auth === 'user' ? (
            <>
              <Link to="/account">{t('nav.myAccount')}</Link>
              <button type="button" className="mobile-menu-action" onClick={onSignOut}>
                {t('account.signOut')}
              </button>
            </>
          ) : (
            <>
              <Link to="/register">{t('nav.createAccount')}</Link>
              <Link to="/login">{t('nav.signIn')}</Link>
            </>
          )}
          {extra}
        </div>
      )}
    </>
  );
}