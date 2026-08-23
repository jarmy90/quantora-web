import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { commercialCatalog } from '../commercial/catalog';
import { findPublicStrategy } from '../catalog';
import { buildProductOffer, type AccessMode } from '../domain/commercial/productOffer';
import { AccessModeSelector, ProductSummaryCard } from '../components/AccessModeSelector';
import { Logo } from '../components/Logo';
import { Footer } from '../components/Footer';
import { t } from '../i18n';
import '../styles/app.css';

function ProductNav() {
  return (
    <header className="wrap">
      <nav className="nav" aria-label="Primary">
        <Logo />
        <div className="nav-actions">
          <Link className="btn" to="/strategies">{t('nav.backCatalog')}</Link>
        </div>
      </nav>
    </header>
  );
}

function InstallMini() {
  return (
    <section className="card" style={{ marginTop: 15 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>{t('prod.installTitle')}</div>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>
        {t('prod.installBody')}
      </p>
      <ol className="install-mini">
        <li>{t('prod.installStep1')}</li>
        <li>{t('prod.installStep2')}</li>
        <li>{t('prod.installStep3')}</li>
      </ol>
      <p className="mono research-note" style={{ color: 'var(--amber)' }}>
        {t('prod.installObjective')}
      </p>
    </section>
  );
}

function ProductPage() {
  const { productId } = Route.useParams();
  const entry = commercialCatalog.find((p) => p.productId === productId);
  const strategy = entry ? findPublicStrategy(entry.strategyId) : undefined;
  const offer = strategy ? buildProductOffer(strategy) : undefined;
  const [selected, setSelected] = useState<AccessMode>('monthly');

  if (!offer) {
    return (
      <>
        <ProductNav />
        <main className="wrap" style={{ textAlign: 'center', padding: '90px 0' }}>
          <div className="eyebrow">{t('prod.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(30px,5vw,52px)', margin: '14px 0' }}>{t('prod.notFoundTitle')}</h1>
          <p className="muted" style={{ maxWidth: 520, margin: '0 auto 24px' }}>{t('prod.notFoundBody')}</p>
          <Link className="btn primary" to="/strategies">{t('prod.notFoundCta')}</Link>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <ProductNav />
      <main className="wrap">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/">{t('prod.breadcrumbHome')}</Link>
          <span aria-hidden="true"> / </span>
          <Link to="/strategies">{t('prod.breadcrumbCatalog')}</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{offer.displayName}</span>
        </nav>

        <section className="detail-hero">
          <div className="eyebrow">{t('prod.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(34px,5vw,58px)', letterSpacing: '-.06em', margin: '15px 0 8px' }}>
            {offer.displayName}
          </h1>
          <p className="muted">
            {[offer.market, offer.timeframe].filter(Boolean).join(' · ')} — {t('prod.subtitle')}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <span className="badge">{offer.availabilityLabel}</span>
            <span className="tag">{t('offer.highlightedMode')}: {t('offer.modeMonthly')}</span>
          </div>
        </section>

        <section className="conversion-grid" style={{ marginTop: 15 }}>
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 10 }}>{t('prod.conversionTitle')}</div>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>
              {t('prod.conversionIntro')}
            </p>
            <ol className="conversion-steps">
              <li><strong>{t('prod.step1Title')}</strong><span className="muted">{t('prod.step1Body')}</span></li>
              <li><strong>{t('prod.step2Title')}</strong><span className="muted">{t('prod.step2Body')}</span></li>
              <li className="step-disabled"><strong>{t('prod.step3Title')}</strong><span className="muted">{t('prod.step3Body')}</span></li>
            </ol>
          </div>

          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 10 }}>{t('offer.chooseMode')}</div>
            <AccessModeSelector
              offer={offer}
              value={selected}
              onChange={(mode) => setSelected(mode)}
            />
          </div>
        </section>

        <section className="card" style={{ marginTop: 15 }}>
          <ProductSummaryCard offer={offer} selected={selected} />
        </section>

        <section className="card" style={{ marginTop: 15 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{t('prod.includeTitle')}</div>
          <ul className="rule-list">
            {offer.productBenefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
          <p className="mono research-note">{t('prod.includeNote')}</p>
        </section>

        <div className="conversion-grid" style={{ marginTop: 15 }}>
          <section className="card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>{t('prod.requirementsTitle')}</div>
            <ul className="rule-list">
              {offer.requirements.map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </section>
          <section className="card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>{t('prod.limitationsTitle')}</div>
            <ul className="rule-list">
              {offer.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </section>
        </div>

        <InstallMini />

        <section className="card" style={{ marginTop: 15 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link className="btn primary" to="/strategies/$id" params={{ id: offer.strategyId } as never}>
              {t('prod.detailBacktest')}
            </Link>
            <Link className="btn" to="/how-to-install">{t('prod.guideLink')}</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/products/$productId')({
  head: () => ({
    meta: [
      { title: 'Quantora products — plans and access' },
      { name: 'description', content: 'Explore Quantora product access modes, availability and what an active product will include.' },
      { property: 'og:title', content: 'Quantora products — plans and access' },
      { property: 'og:description', content: 'Explore Quantora product access modes, availability and what an active product will include.' },
    ],
  }),
  component: ProductPage,
});
