import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Nav } from './Nav';
import { Footer } from './Footer';
import { t } from '../i18n';

export type LegalSection = {
  heading: string;
  body: string;
};

/**
 * Shared shell for the placeholder legal pages: consistent header, a prominent
 * "placeholder, review by counsel" banner, the passed-in legal content sections,
 * and the standard footer with legal navigation.
 */
export function LegalShell({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <Nav extra={<Link to="/legal/disclaimer">{t('footer.legal')}</Link>} />
      <main className="wrap legal">
        <div className="legal-hero">
          <div className="eyebrow">{t('legal.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(30px,4.5vw,48px)', letterSpacing: '-.05em', margin: '12px 0 6px' }}>
            {title}
          </h1>
          <p className="muted" style={{ fontSize: 12 }}>
            {t('legal.updated')}: {updated}
          </p>
        </div>

        <div className="card legal-review">
          <div className="eyebrow">PLACEHOLDER</div>
          <p style={{ lineHeight: 1.7, margin: '10px 0 0', color: 'var(--text)' }}>{t('legal.review')}</p>
        </div>

        <div className="card">
          <p className="muted" style={{ lineHeight: 1.8, borderLeft: '3px solid var(--lime)', paddingLeft: 14 }}>
            {t('legal.financial')}
          </p>
        </div>

        {sections.map((s) => (
          <section key={s.heading} className="legal-section">
            <h2>{s.heading}</h2>
            <p>{s.body}</p>
            <p className="muted legal-ph">{t('legal.placeholderSection')}</p>
          </section>
        ))}

        <p className="muted" style={{ fontSize: 12, margin: '30px 0' }}>
          <Link to="/" style={{ color: 'var(--lime)' }}>
            {t('legal.home')}
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
