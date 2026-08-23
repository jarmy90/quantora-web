import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
// Note: Link is still used by the legal-links row at the bottom of the card.
import { Logo } from './Logo';
import { t } from '../i18n';
import '../styles/app.css';

/**
 * Shared visual shell for the auth pages (login, register, forgot/reset
 * password). Keeps the Quantora identity — dark background, lime accent,
 * calm copy — instead of a generic form page. Fully responsive.
 */
export function AuthCard({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="wrap site-header">
        <nav className="nav" aria-label="Primary">
          {/* Logo renders its own home link — never nest it inside another anchor. */}
          <Logo />
        </nav>
      </header>
      <main className="wrap auth-main">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            {eyebrow}
          </div>
          <h1 id="auth-title" className="auth-title">
            {title}
          </h1>
          <p className="auth-body">{body}</p>
          {children}
          <p className="auth-foot muted">
            {t('auth.legalNote')}{' '}
            <Link to="/legal/privacy">{t('auth.privacy')}</Link> ·{' '}
            <Link to="/legal/terms">{t('auth.terms')}</Link>
          </p>
        </section>
      </main>
    </>
  );
}
