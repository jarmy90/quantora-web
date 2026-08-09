import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { profiles } from '../domain/product';
import type { MarketContext, RiskLevel, ExperienceLevel, TradeFrequency } from '../domain/product';
import {
  CATALOG_CONTEXT_OPTIONS,
  CATALOG_RISK_OPTIONS,
  CATALOG_EXPERIENCE_OPTIONS,
  CATALOG_FREQUENCY_OPTIONS,
} from '../domain/product';
import { t } from '../i18n';
import { CatalogNav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { StrategyCard } from '../components/StrategyCard';
import { CompareTray } from '../components/CompareTray';
import { EmptyState, SkeletonCards, PowerScoreExplain, Seo } from '../components/ui';
import { track } from '../analytics/analytics';
import '../styles/app.css';

type Filters = {
  context: MarketContext | 'all';
  risk: RiskLevel | 'all';
  experience: ExperienceLevel | 'all';
  frequency: TradeFrequency | 'all';
  sort: 'score' | 'name' | 'pf';
};

function Catalog() {
  const [filters, setFilters] = useState<Filters>({
    context: 'all',
    risk: 'all',
    experience: 'all',
    frequency: 'all',
    sort: 'score',
  });
  // Brief skeleton on first paint to demonstrate the loading state (client only).
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    track({ category: 'navigation', action: 'view', label: 'catalog' });
    return () => clearTimeout(timer);
  }, []);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const list = useMemo(() => {
    const filtered = profiles.filter(
      (p) =>
        (filters.context === 'all' || p.marketContext === filters.context) &&
        (filters.risk === 'all' || p.riskLevel === filters.risk) &&
        (filters.experience === 'all' || p.experienceLevel === filters.experience) &&
        (filters.frequency === 'all' || p.frequency === filters.frequency),
    );
    return [...filtered].sort((a, b) => {
      if (filters.sort === 'name') return a.name.localeCompare(b.name);
      if (filters.sort === 'pf') {
        const pa = a.metrics.profitFactor ?? -1;
        const pb = b.metrics.profitFactor ?? -1;
        return pb - pa;
      }
      return b.metrics.powerScore - a.metrics.powerScore;
    });
  }, [filters]);

  const activeFilters =
    filters.context !== 'all' || filters.risk !== 'all' || filters.experience !== 'all' || filters.frequency !== 'all';

  return (
    <>
      <Seo
        title="Strategy catalog — Quantora"
        description="Browse algorithmic MetaTrader 5 strategies with transparent Power Scores, owner-provided metrics and clear risk labels. Not investment advice."
      />
      <CatalogNav />
      <main id="catalog" className="wrap">
        <section className="catalog-head">
          <div className="eyebrow">{t('catalog.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(34px,5vw,56px)', letterSpacing: '-.06em', margin: '15px 0' }}>
            {t('catalog.title')}
          </h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            {t('catalog.body')}
          </p>
          <div className="actions" style={{ marginTop: 22 }}>
            <Link className="btn" to="/matcher">
              {t('catalog.matcherCta')} →
            </Link>
            <Link className="btn primary" to="/publish">
              {t('catalog.publishCta')} →
            </Link>
          </div>
          <div className="card score-card" style={{ marginTop: 22 }}>
            <PowerScoreExplain compact />
          </div>
          <div className="filters" role="group" aria-label={t('catalog.filtersLabel')}>
            <select
              className="select"
              value={filters.context}
              onChange={(e) => set('context', e.target.value as Filters['context'])}
            >
              {CATALOG_CONTEXT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select className="select" value={filters.risk} onChange={(e) => set('risk', e.target.value as Filters['risk'])}>
              {CATALOG_RISK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={filters.experience}
              onChange={(e) => set('experience', e.target.value as Filters['experience'])}
            >
              {CATALOG_EXPERIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={filters.frequency}
              onChange={(e) => set('frequency', e.target.value as Filters['frequency'])}
            >
              {CATALOG_FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select className="select" value={filters.sort} onChange={(e) => set('sort', e.target.value as Filters['sort'])}>
              <option value="score">{t('catalog.sortScore')}</option>
              <option value="pf">{t('catalog.sortPf')}</option>
              <option value="name">{t('catalog.sortName')}</option>
            </select>
          </div>
        </section>

        {loading ? (
          <SkeletonCards count={6} />
        ) : list.length === 0 ? (
          <EmptyState
            title={t('catalog.emptyTitle')}
            body={t('catalog.emptyBody')}
            action={
              <button className="btn" onClick={() => setFilters({ context: 'all', risk: 'all', experience: 'all', frequency: 'all', sort: 'score' })}>
                {t('catalog.clearFilters')}
              </button>
            }
          />
        ) : (
          <>
            <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              {list.length} {list.length === 1 ? t('catalog.strategy') : t('catalog.strategies')}
              {activeFilters && ` · ${t('catalog.filtered')}`}
            </p>
            <div className="grid" style={{ paddingBottom: 90 }}>
              {list.map((p) => (
                <StrategyCard key={p.id} profile={p} />
              ))}
            </div>
          </>
        )}
      </main>
      <CompareTray />
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/strategies/')({ component: Catalog });
