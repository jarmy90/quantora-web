/**
 * QNT-0015 · Product offer card.
 *
 * Reusable, auth-aware product block rendered on each real strategy detail
 * page. It derives the offer from the strategy's public data (never from
 * hardcoded component values), resolves the CTA from availability + auth, and
 * only ever leads to the informative product preview or a safe internal login
 * return. It never creates an order, checkout, payment, licence or download.
 */
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { PublicStrategy } from '../domain/publicStrategy';
import { buildProductOffer, resolveProductCta } from '../domain/commercial/productOffer';
import { getAuthStatus } from '../domain/auth/server';
import { t } from '../i18n';

function useAuthStatus(): boolean | null {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const status = await getAuthStatus();
        if (!cancelled) setAuthenticated(Boolean(status.user));
      } catch {
        if (!cancelled) setAuthenticated(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return authenticated;
}

export function ProductOfferCard({ strategy }: { strategy: PublicStrategy }) {
  const offer = buildProductOffer(strategy);
  const isAuthenticated = useAuthStatus();
  const [notifyOpen, setNotifyOpen] = useState(false);

  useEffect(() => {
    if (!notifyOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotifyOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notifyOpen]);

  if (!offer) return null;

  const cta = resolveProductCta(offer, { isAuthenticated: isAuthenticated === true });

  return (
    <section className="card product-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="eyebrow" style={{ marginBottom: 0 }}>{t('offer.eyebrow')}</div>
        <span className="status-chip coming-soon">{t('offer.comingSoon')}</span>
      </div>
      <h2 style={{ fontSize: 23, margin: '14px 0 6px' }}>{t('offer.title')}</h2>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 720 }}>
        {t('offer.body')}
      </p>
      <div className="product-meta" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <span className="tag">{t('offer.highlightedMode')}: {t('offer.modeMonthly')}</span>
        <span className="tag">{t('offer.availability')}: {offer.availabilityLabel}</span>
      </div>
      <ul className="offer-benefits" style={{ margin: '14px 0 0' }}>
        {offer.productBenefits.map((benefit) => (
          <li key={benefit} className="muted">{benefit}</li>
        ))}
      </ul>
      <p className="muted offer-note">{t('offer.priceNote')}</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        {cta.ctaState === 'signIn' && (
          <Link className="btn primary" to="/login" search={{ returnTo: cta.returnTo } as never}>
            {cta.ctaLabel} →
          </Link>
        )}
        {cta.ctaState === 'seeOptions' && (
          <Link className="btn primary" to="/products/$productId" params={{ productId: offer.productId } as never}>
            {cta.ctaLabel} →
          </Link>
        )}
        <button type="button" className="btn" onClick={() => setNotifyOpen(true)}>
          {t('offer.notifyMe')}
        </button>
        <a className="btn" href="#how-it-works">{t('offer.viewMethodology')}</a>
      </div>
      {notifyOpen && (
        <div className="dialog-backdrop" onClick={() => setNotifyOpen(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="offer-notify-title">
            <h3 id="offer-notify-title" style={{ margin: '0 0 10px' }}>{t('offer.notifyDialogTitle')}</h3>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 18px' }}>
              {t('offer.notifyDialogBody')}
            </p>
            <button type="button" className="btn primary" onClick={() => setNotifyOpen(false)} autoFocus>
              {t('offer.notifyClose')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
