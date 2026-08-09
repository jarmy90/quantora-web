import { createFileRoute, Link } from '@tanstack/react-router';
import { findProfile } from '../domain/product';
import { useCompare } from '../state/compare';
import { t } from '../i18n';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { PowerScore, PowerScoreExplain, EmptyState, Seo } from '../components/ui';
import '../styles/app.css';

/** Comparison rows: label + per-strategy value accessors (no metric duplication). */
const ROWS: { label: string; get: (id: string) => string }[] = [
  { label: 'Power Score', get: (id) => findProfile(id)?.metrics.powerScore.toFixed(1) ?? '—' },
  { label: 'Profit factor', get: (id) => findProfile(id)?.metrics.profitFactor?.toFixed(4) ?? '—' },
  { label: 'Operations', get: (id) => findProfile(id)?.metrics.tradeCount?.toLocaleString('en-US') ?? '—' },
  {
    label: 'Net result',
    get: (id) => {
      const v = findProfile(id)?.metrics.netProfitUsd;
      return v === undefined ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD`;
    },
  },
  {
    label: 'Max drawdown',
    get: (id) => {
      const p = findProfile(id);
      if (!p) return '—';
      const parts: string[] = [];
      if (p.metrics.maxDrawdownPct !== undefined) parts.push(`${p.metrics.maxDrawdownPct.toFixed(2)}%`);
      if (p.metrics.maxDrawdownUsd !== undefined)
        parts.push(`${p.metrics.maxDrawdownUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD`);
      return parts.length ? parts.join(' / ') : '—';
    },
  },
  { label: 'Market context', get: (id) => findProfile(id)?.marketContext ?? '—' },
  { label: 'Risk level', get: (id) => findProfile(id)?.riskLevel ?? '—' },
  { label: 'Experience', get: (id) => findProfile(id)?.experienceLevel ?? '—' },
  { label: 'Frequency', get: (id) => findProfile(id)?.frequency ?? '—' },
  { label: 'Data status', get: (id) => (findProfile(id)?.dataStatus === 'real' ? 'Owner-provided' : 'Mock demo') },
];

function Compare() {
  const compare = useCompare();
  const selected = compare.ids.map((id) => findProfile(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <>
      <Seo
        title="Compare strategies — Quantora"
        description="Compare up to three algorithmic strategies side by side with transparent, owner-provided metrics. Not investment advice."
      />
      <Nav />
      <main className="wrap">
        <section className="catalog-head">
          <div className="eyebrow">{t('compare.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', letterSpacing: '-.06em', margin: '15px 0' }}>
            {t('compare.title')}
          </h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            {t('compare.body')}
          </p>
          <div className="actions" style={{ marginTop: 18 }}>
            <Link className="btn" to="/strategies">
              {t('compare.addMore')} →
            </Link>
            {selected.length > 0 && (
              <button className="btn" onClick={() => compare.clear()}>
                {t('compare.clear')}
              </button>
            )}
          </div>
        </section>

        {selected.length === 0 ? (
          <EmptyState
            title={t('compare.emptyTitle')}
            body={t('compare.emptyBody')}
            action={
              <Link className="btn primary" to="/strategies">
                {t('home.browse')}
              </Link>
            }
          />
        ) : (
          <div className="compare-wrap" style={{ paddingBottom: 80 }}>
            <table className="log compare-table">
              <thead>
                <tr>
                  <th />
                  {selected.map((p) => (
                    <th key={p.id}>
                      <div className="compare-head">
                        <PowerScore score={p.metrics.powerScore} />
                        <Link to="/strategies/$id" params={{ id: p.id }} style={{ color: 'var(--text)' }}>
                          {p.name}
                        </Link>
                        <button className="btn btn-sm" onClick={() => compare.toggle(p.id)}>
                          {t('compare.remove')}
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <td style={{ fontWeight: 700 }}>{row.label}</td>
                    {selected.map((p) => (
                      <td key={p.id} className="muted">
                        {row.get(p.id)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card score-card" style={{ marginTop: 20 }}>
              <PowerScoreExplain compact />
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>
              {t('compare.note')} · {t('compare.recommendation')}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/compare')({ component: Compare });
