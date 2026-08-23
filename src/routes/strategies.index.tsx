import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { strategies } from '../data';
import { publicStrategies } from '../catalog';
import { PublicStrategyCard } from '../components/PublicStrategyCard';
import { t } from '../i18n';
import { CatalogNav } from '../components/Nav';
import { Footer } from '../components/Footer';
import '../styles/app.css';

const Spark = ({ points, color }: { points: number[]; color: string }) => (
  <svg className="curve" viewBox="0 0 300 65" preserveAspectRatio="none" aria-hidden="true">
    <polyline
      fill="none"
      stroke={color}
      strokeWidth="2"
      points={points.map((p, i) => `${i * 15.7},${65 - (p - 20) * 1.1}`).join(' ')}
    />
  </svg>
);

function Catalog() {
  const [asset, setAsset] = useState('All');
  const [risk, setRisk] = useState('All');
  const [sort, setSort] = useState('return');

  const list = useMemo(
    () =>
      strategies
        .filter(
          (s) =>
            (asset === 'All' || s.assets.includes(asset as never)) &&
            (risk === 'All' || s.risk === risk),
        )
        .sort((a, b) =>
          sort === 'return' ? b.returnPct - a.returnPct : a.name.localeCompare(b.name),
        ),
    [asset, risk, sort],
  );

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

        {publicStrategies.length > 0 && (
          <section className="real-section" style={{ marginBottom: 30 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              {t('catalog.published')}
            </div>
            <div className="grid">
              {publicStrategies.map((s) => (
                <PublicStrategyCard key={s.id} s={s} />
              ))}
            </div>
          </section>
        )}

        <section className="demo-section" style={{ paddingBottom: 70 }}>
          <div className="eyebrow">{t('catalog.demoSection')}</div>
          <p className="mono demo-note" style={{ marginBottom: 14 }}>
            {t('catalog.demoNote')}
          </p>
          <div className="demo-filters">
            <span className="mono demo-note">{t('catalog.demoFilters')}</span>
            <div className="filters" style={{ margin: '8px 0 0' }}>
              <select className="select" value={asset} onChange={(e) => setAsset(e.target.value)}>
                <option>All</option>
                <option>BTC</option>
                <option>ETH</option>
                <option>SPY</option>
                <option>NASDAQ</option>
              </select>
              <select className="select" value={risk} onChange={(e) => setRisk(e.target.value)}>
                <option>All</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="return">{t('catalog.sortReturn')}</option>
                <option value="name">{t('catalog.sortName')}</option>
              </select>
            </div>
          </div>
          <div className="grid" style={{ marginTop: 15 }}>
            {list.map((s) => (
              <Link to="/strategies/$id" params={{ id: s.id }} className="card demo-card" key={s.id}>
                <div className="strategy-top">
                  <div>
                    <span className="badge">{s.assets.join(' · ')}</span>
                    <h3 style={{ margin: '14px 0 4px', fontSize: 17 }}>{s.name}</h3>
                    <div className="tag">{s.tagline}</div>
                  </div>
                  <span style={{ color: s.color }} aria-hidden="true">↗</span>
                </div>
                <Spark points={s.curve} color={s.color} />
                <div className="stats">
                  <div>
                    <small>{t('common.demoReturn')}</small>
                    <strong style={{ color: 'var(--lime)' }}>+{s.returnPct}%</strong>
                  </div>
                  <div>
                    <small>{t('common.risk')}</small>
                    <strong>{s.risk}</strong>
                  </div>
                  <div>
                    <small>{t('common.maxDD')}</small>
                    <strong>{s.maxDrawdown}</strong>
                  </div>
                </div>
              </Link>
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
