import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { findProfile } from '../domain/product';
import { t } from '../i18n';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import {
  BackLink,
  DimensionBars,
  MetricTile,
  PowerScore,
  PowerScoreExplain,
  RiskNotice,
  StatusBadge,
  Seo,
} from '../components/ui';
import { useFavorites } from '../state/favorites';
import { useCompare } from '../state/compare';
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card detail-section">
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function Detail() {
  const { id } = useParams({ from: '/strategies/$id' });
  const profile = findProfile(id);
  const favorites = useFavorites();
  const compare = useCompare();

  if (!profile) {
    return (
      <>
        <Nav />
        <main className="wrap detail-hero">
          <div className="card" style={{ marginTop: 40 }}>
            <h1 style={{ fontSize: 28 }}>{t('detail.notFound')}</h1>
            <p className="muted">{t('detail.notFoundBody')}</p>
            <Link className="btn" to="/strategies">
              {t('detail.backCatalog')}
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const m = profile.metrics;
  const isReal = profile.dataStatus === 'real';
  const favourite = favorites.isFavorite(profile.id);
  const inCompare = compare.isCompared(profile.id);

  return (
    <>
      <Seo
        title={`${profile.name} — Quantora`}
        description={`${profile.tagline}. Power Score ${m.powerScore.toFixed(1)}/10. ${isReal ? 'Metrics provided by the owner.' : 'Mock demo data.'} Not investment advice.`}
      />
      <Nav />
      <main className="wrap">
        <div style={{ marginTop: 28 }}>
          <BackLink />
        </div>

        <section className="detail-hero">
          <div className="detail-head">
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <StatusBadge status={profile.dataStatus} />
                {profile.assets.length > 0 && <span className="badge">{profile.assets.join(' · ')}</span>}
                <span className="badge">{profile.marketContext}</span>
                <span className="badge">{profile.riskLevel} risk</span>
                <span className="badge">{profile.frequency} frequency</span>
                <span className="badge">{profile.experienceLevel}</span>
              </div>
              <h1 style={{ fontSize: 'clamp(32px,5vw,54px)', letterSpacing: '-.05em', margin: '16px 0 6px' }}>
                {profile.name}
              </h1>
              <p className="muted" style={{ fontSize: 16, maxWidth: 620 }}>
                {profile.tagline}
              </p>
              <p style={{ maxWidth: 680, lineHeight: 1.7, color: 'var(--text)', marginTop: 14 }}>
                {profile.description}
              </p>
            </div>
            <div className="detail-score">
              <PowerScore score={m.powerScore} size="lg" />
              <span className="mono score-tag">POWER SCORE / 10</span>
            </div>
          </div>
          <div className="actions" style={{ marginTop: 18 }}>
            <button
              className={`btn ${favourite ? 'primary' : ''}`}
              aria-pressed={favourite}
              onClick={() => favorites.toggle(profile.id)}
            >
              {favourite ? '♥ ' + t('detail.favoriteRemove') : '♡ ' + t('detail.favoriteAdd')}
            </button>
            <button
              className={`btn ${inCompare ? 'primary' : ''}`}
              disabled={!inCompare && !compare.canAdd}
              onClick={() => compare.toggle(profile.id)}
            >
              {inCompare ? '✓ ' + t('compare.inBasket') : '+ ' + t('compare.add')}
            </button>
            <Link className="btn" to="/compare">
              {t('compare.view')} →
            </Link>
          </div>
        </section>

        <div className="detail-layout">
          <div>
            <Section title={t('detail.metrics')}>
              <div className="metric-grid">
                {profile.dataBehindScore.map((row) => (
                  <MetricTile key={row.label} label={row.label} value={row.value} />
                ))}
              </div>
              {isReal ? (
                <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
                  {t('detail.metricsNote')}
                </p>
              ) : (
                <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
                  {t('detail.mockMetricsNote')}
                </p>
              )}
            </Section>

            {!isReal && profile.curve && (
              <Section title={t('detail.curveMock')}>
                <Spark points={profile.curve} color={profile.color} />
                <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                  {t('detail.curveMockNote')}
                </p>
              </Section>
            )}
            {isReal && (
              <Section title={t('detail.curvePending')}>
                <p className="muted" style={{ lineHeight: 1.7 }}>
                  {t('detail.curvePendingBody')}
                </p>
              </Section>
            )}

            <Section title={t('detail.howItWorks')}>
              <ol className="steps-list">
                {profile.howItWorks.map((step, i) => (
                  <li key={i}>
                    <span className="step-num mono">{String(i + 1).padStart(2, '0')}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </Section>

            <Section title={t('detail.dimensions')}>
              <DimensionBars dimensions={profile.dimensions} />
              <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
                {t('detail.dimensionsNote')}
              </p>
            </Section>

            <Section title={t('detail.methodology')}>
              <ul className="plain-list">
                {profile.methodology.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Section>

            <Section title={t('detail.limitations')}>
              <ul className="plain-list warn">
                {profile.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Section>

            <Section title={t('detail.evidence')}>
              <table className="log">
                <tbody>
                  {profile.evidence.map((row) => (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{row.label}</td>
                      <td className="muted">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <div className="card score-card">
              <PowerScoreExplain />
            </div>
          </div>

          <aside>
            <div className="card buy" style={{ position: 'sticky', top: 20 }}>
              <div className="eyebrow">{t('detail.fitsTitle')}</div>
              <div className="fits-list">
                {profile.fitsYou.map((f) => (
                  <div className="fit-item" key={f.label}>
                    <strong>{f.label}</strong>
                    <p className="muted">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginTop: 15 }}>
              <div className="eyebrow">{t('detail.contextTitle')}</div>
              <h3 style={{ fontSize: 15, margin: '10px 0 6px', color: 'var(--lime)' }}>✓ {t('detail.suitable')}</h3>
              <ul className="plain-list">
                {profile.suitableFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h3 style={{ fontSize: 15, margin: '16px 0 6px', color: 'var(--red)' }}>✕ {t('detail.notSuitable')}</h3>
              <ul className="plain-list">
                {profile.notSuitableFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <RiskNotice />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/strategies/$id')({ component: Detail });
