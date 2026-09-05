import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { findPublicStrategy } from '../catalog';
import type { PublicStrategy } from '../domain/publicStrategy';
import type { EquityPoint } from '../domain/types';
import { fmtDate, fmtNum, fmtNumDec, fmtPct, fmtPeriod, fmtPoints, fmtSignedPoints, fmtSignedUsd, fmtUsd } from '../format';
import { t } from '../i18n';
import { Logo } from '../components/Logo';
import { Footer } from '../components/Footer';
import { EasyStartSteps } from '../components/EasyStartSteps';
import { DemoMonitoringCard } from '../components/DemoMonitoringCard';
import '../styles/app.css';

const CYAN = '#72d9ff';
const LIME = '#c9ff5a';
const RED = '#ff7185';
const GREEN = '#4ade80';
const AMBER = '#e0a860';

function Nav() {
  return (
    <header className="wrap">
      <nav className="nav">
        <Logo />
        <Link to="/strategies" className="btn">
          {t('nav.backCatalog')}
        </Link>
      </nav>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Real strategy detail (generated from the versioned public dataset)
// ---------------------------------------------------------------------------

/**
 * Equity-curve chart driven by the real equity points (timestamp + value).
 * Hovering reveals the closest point's date, equity and drawdown. Point-based
 * strategies (performanceUnit = "points") render points, not USD.
 */
function RealEquityChart({ points, unit }: { points: EquityPoint[]; unit: 'points' | 'usd' }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = points.length;
  if (total < 2) return <p className="muted">—</p>;
  const fmtEquity = (value: number): string => (unit === 'points' ? fmtPoints(value) : fmtUsd(value));

  const values = points.map((p) => p.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const line = points
    .map((p, i) => `${(i / (total - 1)) * 100},${96 - ((p.equity - min) / range) * 92}`)
    .join(' ');
  const hoverIndex = hover !== null ? Math.min(total - 1, Math.max(0, hover)) : null;
  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : undefined;

  return (
    <>
      <svg
        className="chart"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = (e.clientX - rect.left) / Math.max(1, rect.width);
          setHover(Math.floor(frac * total));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="realFill" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor={CYAN} stopOpacity=".22" />
            <stop offset="1" stopColor={CYAN} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon fill="url(#realFill)" points={`0,100 ${line} 100,100`} />
        <polyline fill="none" stroke={CYAN} strokeWidth=".6" points={line} />
        {hoverIndex !== null && (
          <line
            x1={(hoverIndex / (total - 1)) * 100}
            x2={(hoverIndex / (total - 1)) * 100}
            y1="4"
            y2="100"
            stroke="#ffffff55"
            strokeDasharray="2"
          />
        )}
      </svg>
      {hoverPoint && (
        <div className="mono" style={{ fontSize: 11, marginTop: 10, color: 'var(--muted)' }}>
          {fmtDate(hoverPoint.timestamp)} · {fmtEquity(hoverPoint.equity)}
          {hoverPoint.drawdown !== undefined && ` · ${t('detail.drawdownValue')} ${fmtEquity(hoverPoint.drawdown)}`}
        </div>
      )}
    </>
  );
}

function RealDetail({ s }: { s: PublicStrategy }) {
  const m = s.metrics ?? {};
  const score = s.score;
  const pointsUnit = s.performanceUnit === 'points';

  const cells: {
    label: string;
    value: string;
    accent?: string;
    title?: string;
    note?: string;
  }[] = [
    {
      label: t('detail.score'),
      value: score ? String(score.value) : '—',
      accent: LIME,
      title: t('detail.scoreExplanation'),
      note:
        score?.confidence !== undefined
          ? t('detail.evidenceConfidence').replace('{pct}', String(Math.round(score.confidence * 100)))
          : undefined,
    },
    {
      label: t('detail.profitFactor'),
      value: m.profitFactor !== undefined ? m.profitFactor.toFixed(2) : '—',
    },
    { label: t('detail.winRate'), value: m.winRate !== undefined ? fmtPct(m.winRate) : '—' },
    { label: t('detail.totalTrades'), value: m.trades !== undefined ? fmtNum(m.trades) : '—' },
    {
      label: t('detail.frequency'),
      value: m.frequencyPerMonth !== undefined ? `${fmtNum(m.frequencyPerMonth)} ${t('detail.freqPerMonth')}` : '—',
    },
    {
      label: pointsUnit ? t('detail.closedTradeDrawdown') : t('detail.maxDrawdown'),
      value:
        m.maxDrawdownPoints !== undefined
          ? fmtPoints(m.maxDrawdownPoints) + (m.closedTradeDrawdownDecimal !== undefined ? ` · ${(m.closedTradeDrawdownDecimal * 100).toFixed(2)}%` : '')
          : m.maxDrawdownUsd !== undefined
            ? fmtUsd(m.maxDrawdownUsd) + (m.closedTradeDrawdownDecimal !== undefined ? ` · ${(m.closedTradeDrawdownDecimal * 100).toFixed(2)}%` : '')
            : '—',
      accent: AMBER,
      title: pointsUnit ? t('detail.drawdownNote') : undefined,
    },
    ...(m.costPerTradeUsd !== undefined
      ? [
          {
            label: t('detail.costs'),
            value: `${fmtUsd(m.costPerTradeUsd)} / trade`,
          },
        ]
      : []),
    {
      label: t('detail.netResult'),
      value:
        m.netPoints !== undefined
          ? fmtSignedPoints(m.netPoints)
          : m.netUsd !== undefined
            ? fmtSignedUsd(m.netUsd)
            : '—',
      accent: (m.netPoints ?? m.netUsd ?? 0) >= 0 ? GREEN : RED,
    },
    {
      label: t('detail.expectancy'),
      value:
        m.expectancyPoints !== undefined
          ? `${fmtNumDec(m.expectancyPoints)} ${t('detail.ptsPerTrade')}`
          : m.expectancyUsd !== undefined
            ? `${fmtUsd(m.expectancyUsd)} / trade`
            : '—',
    },
  ];

  if (m.openPositionsAtEnd !== undefined) {
    cells.push({
      label: t('detail.openPositionsAtEnd'),
      value: String(fmtNum(m.openPositionsAtEnd)),
    });
  }

  return (
    <>
      <Nav />
      <main className="wrap">
        <section className="detail-hero">
          <div className="eyebrow">{s.type ?? t('catalog.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(34px,5vw,58px)', letterSpacing: '-.06em', margin: '15px 0 8px' }}>
            {s.name}
          </h1>
          <p className="muted">{s.description}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <span className="badge published">{t('catalog.publishedStrategy')}</span>
            <span className="badge">{t('detail.historicalBacktest')}</span>
            {s.version && <span className="badge">{t('detail.version')} {s.version}</span>}
            {s.market && <span className="badge">{t('detail.market')}: {s.market}</span>}
            {s.instrument && <span className="badge">{t('detail.instrument')}: {s.instrument}</span>}
            {s.period && <span className="badge">{fmtPeriod(s.period.start, s.period.end)}</span>}
          </div>
        </section>

        <section className="card chart-card">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {pointsUnit ? t('detail.closedTradeEquity') : t('detail.equityCurve')}
          </div>
          <RealEquityChart points={s.equity?.points ?? []} unit={pointsUnit ? 'points' : 'usd'} />
        </section>

        <section className="metric-grid" style={{ marginTop: 15 }}>
          {cells.map((cell) => (
            <div className="metric-cell" key={cell.label}>
              <small>{cell.label}</small>
              <strong title={cell.title} style={cell.accent ? { color: cell.accent } : undefined}>
                {cell.value}
              </strong>
              {cell.note && <small className="metric-note">{cell.note}</small>}
            </div>
          ))}
        </section>

        <section className="card" style={{ marginTop: 15 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{t('detail.tradingCosts')}</div>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0, maxWidth: 760 }}>
            {s.costsApplied === false ? t('detail.costsNotIncludedCopy') : t('detail.costsIncludedCopy')}
          </p>
        </section>

        <section className="card product-card" style={{ marginTop: 15 }}>
          <div className="eyebrow" style={{ marginBottom: 0 }}>{t('detail.earlyAccess')}</div>
          <h2 style={{ fontSize: 23, margin: '14px 0 6px' }}>{t('detail.earlyAccessTitle')}</h2>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 720 }}>
            {t('detail.earlyAccessBody')}
          </p>
          <div className="product-meta" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            {s.productId && <span className="tag">{t('detail.productId')}: {s.productId}</span>}
            <span className="tag">
              {t('detail.commercialDownload')}:{' '}
              {s.commercialDownloadEnabled ? t('detail.commercialDownloadEnabled') : t('detail.commercialDownloadDisabled')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <Link className="btn primary" to="/register" search={{ returnTo: `/strategies/${s.id}` } as never}>
              {t('detail.getAccessUpdates')}
            </Link>
            <a className="btn" href="#how-it-works">{t('detail.viewMethodology')}</a>
          </div>
          <p className="mono research-note">{t('detail.earlyAccessNote')}</p>
        </section>

        <DemoMonitoringCard strategyId={s.id} />

        <section className="card" style={{ marginTop: 15 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{t('easy.installBlockEyebrow')}</div>
          <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>{t('easy.installBlockTitle')}</h2>
          <EasyStartSteps mode="compact" asLinkTo="/how-to-install" />
        </section>

        <section id="how-it-works" className="card" style={{ marginTop: 15 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {t('detail.howItWorks')}
          </div>
          <ul className="rule-list">
            {s.market && (
              <li>
                {t('detail.market')}: {s.market}
                {s.instrument ? ` (${s.instrument})` : ''}
              </li>
            )}
            {(s.rules ?? []).map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
            {s.variant && <li>Variant: {s.variant}</li>}
            {s.configuration && <li>Configuration: {s.configuration}</li>}
          </ul>

          <p className="mono research-note">{t('detail.tradingCostsMethodology')}</p>
          <p className="mono research-note">{t('detail.researchNote')}</p>
        </section>

        {pointsUnit && (
          <section className="card" style={{ marginTop: 15 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              {t('detail.evidence')}
            </div>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              {t('detail.evidenceClosedTrade')}
            </p>
          </section>
        )}

        <section className="card" style={{ marginTop: 15 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {t('detail.limitations')}
          </div>
          <ul className="rule-list">
            {(s.limitations ?? []).map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
          {s.disclaimer && <p className="mono research-note">{s.disclaimer}</p>}
        </section>
      </main>
      <Footer />
    </>
  );
}

function Detail() {
  const { id } = Route.useParams();

  const real = findPublicStrategy(id);
  if (real) return <RealDetail s={real} />;

  return (
    <>
      <Nav />
      <main className="wrap" style={{ textAlign: 'center', padding: '90px 0' }}>
        <div className="eyebrow">{t('detail.eyebrow')}</div>
        <h1 style={{ fontSize: 'clamp(30px,5vw,52px)', margin: '14px 0' }}>
          {t('detail.notFound')}
        </h1>
        <p className="muted" style={{ maxWidth: 520, margin: '0 auto 24px' }}>
          {t('detail.notFoundBody')}
        </p>
        <Link className="btn primary" to="/strategies">
          {t('detail.backCatalog')}
        </Link>
      </main>
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/strategies/$id')({
  head: ({ match }) => {
    const id = match.params.id;
    const real = findPublicStrategy(id);
    const title = real ? `${real.name} — Quantora` : 'Quantora — Strategy';
    return {
      meta: [
        { title },
        { name: 'description', content: t('seo.strategyDescription') },
        { property: 'og:title', content: title },
        { property: 'og:description', content: t('seo.strategyDescription') },
      ],
    };
  },
  component: Detail,
});
