import { createFileRoute } from '@tanstack/react-router';
import { publicStrategies } from '../catalog';
import { PublicStrategyCard } from '../components/PublicStrategyCard';
import { t } from '../i18n';
import { CatalogNav } from '../components/Nav';
import { Footer } from '../components/Footer';
import '../styles/app.css';

function Catalog() {
  return (
    <>
      <CatalogNav />
      <main id="catalog" className="wrap">
        <section className="catalog-head">
          <div className="eyebrow">{t('catalog.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(34px,5vw,56px)', letterSpacing: '-.06em', margin: '15px 0' }}>
            {t('catalog.title')}
          </h1>
          <p className="muted">{t('catalog.body')}</p>
        </section>

        <section className="real-section" style={{ marginBottom: 70 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            {t('catalog.published')}
          </div>
          <div className="grid">
            {publicStrategies.map((s) => (
              <PublicStrategyCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/strategies/')({
  head: () => ({
    meta: [
      { title: 'Quantora — Strategy catalog' },
      { name: 'description', content: t('seo.catalogDescription') },
      { property: 'og:title', content: 'Quantora — Strategy catalog' },
      { property: 'og:description', content: t('seo.catalogDescription') },
    ],
  }),
  component: Catalog,
});