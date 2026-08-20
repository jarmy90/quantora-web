import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { strategies } from '../data';
import { publicStrategies } from '../catalog';
import type { PublicStrategy } from '../domain/publicStrategy';
import { fmtNum, fmtPoints, fmtUsd } from '../format';
import { t } from '../i18n';
import { CatalogNav } from '../components/Nav';
import { Footer } from '../components/Footer';
import '../styles/app.css';

const Spark = ({ points, color }: { points: number[]; color: string }) => (
  <svg className="curve" viewBox="0 0 300 65" preserveAspectRatio="none">
    <polyline
      fill="none"
      stroke={color}
      strokeWidth="2"
      points={points.map((p, i) => `${i * 15.7},${65 - (p - 20) * 1.1}`).join(' ')}
    />
  </svg>
);

/** Small equity sparkline generated from the real equity points. */
function EquitySpark({ points }: { points: number[] }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const poly = points
    .map((p, i) => `${(i / (points.length - 1)) * 300},${65 - ((p - min) / range) * 55}`)
    .join(' ');
  return (
    <svg className="curve" viewBox="0 0 300 65" preserveAspectRatio="none">
      <polyline fill="none" stroke="var(--cyan)" strokeWidth="2" points={poly} />
    </svg>
  );
}

function PublicCard({ s }: { s: PublicStrategy }) {
  const m = s.metrics ?? {};
  const curve = s.equity?.points.map((p) => p.equity) ?? [];
  const score = s.score?.value;
  const pointsUnit = s.performanceUnit === 'points';
  const net = pointsUnit ? m.netPoints : m.netUsd;
  const dd = pointsUnit ? m.maxDrawdownPoints : m.maxDrawdownUsd;
  return (
    <Link to="/strategies/$id" params={{ id: s.id }} className="card" key={s.id}>
      <div className="strategy-top">
        <div>
          <span className="badge">
            {s.market}
            {s.instrument ? ` · ${s.instrument}` : ''}
          </span>
          <h3 style={{ margin: '14px 0 4px', fontSize: 17 }}>{s.name}</h3>
          <div className="tag">{s.tagline}</div>
          {s.version && <div className="tag" style={{ marginTop: 4 }}>v{s.version}</div>}
          {pointsUnit && (
            <div className="tag" style={{ marginTop: 4, color: 'var(--muted)' }}>
              {t('detail.historicalBacktest')} · {t('detail.resultsInPoints')}
              {s.costsApplied === false ? ` · ${t('detail.costsNotApplied')}` : ''}
            </div>
          )}
        </div>
        <span style={{ color: 'var(--cyan)', fontSize: 20 }}>↗</span>
      </div>
      {curve.length > 1 && <EquitySpark points={curve} />}
      <div className="stats">
        <div>
          <small>{t('detail.netResult')}</small>
          <strong style={{ color: net !== undefined && net > 0 ? 'var(--green)' : undefined }}>
            {net !== undefined
              ? `+${pointsUnit ? fmtPoints(net) : fmtUsd(net)}${pointsUnit ? ' pts' : ''}`
              : '—'}
          </strong>
        </div>
        <div>
          <small>{t('detail.profitFactor')}</small>
          <strong>{m.profitFactor !== undefined ? m.profitFactor.toFixed(2) : '—'}</strong>
        </div>
        <div>
          <small>{s.scoreVersion ? t('detail.scoreBeta') : t('detail.score')}</small>
          <strong style={{ color: 'var(--lime)' }}>{score ?? '—'}</strong>
        </div>
      </div>
      <div className="stats" style={{ marginTop: 10 }}>
        <div>
          <small>{t('detail.totalTrades')}</small>
          <strong>{m.trades !== undefined ? fmtNum(m.trades) : '—'}</strong>
        </div>
        <div>
          <small>{t('detail.frequency')}</small>
          <strong>{m.frequencyPerMonth !== undefined ? `${fmtNum(m.frequencyPerMonth)} / mo` : '—'}</strong>
        </div>
        <div>
          <small>{pointsUnit ? t('detail.closedTradeDrawdown') : t('detail.maxDrawdown')}</small>
          <strong style={{ color: 'var(--amber)' }}>
            {dd !== undefined
              ? `${pointsUnit ? fmtPoints(dd) : fmtUsd(dd)}${pointsUnit ? ' pts' : ''}${m.closedTradeDrawdownDecimal !== undefined ? ` · ${(m.closedTradeDrawdownDecimal * 100).toFixed(2)}%` : ''}`
              : '—'}
          </strong>
        </div>
      </div>
    </Link>
  );
}

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
                <PublicCard key={s.id} s={s} />
              ))}
            </div>
          </section>
        )}

        <section className="demo-section" style={{ paddingBottom: 70 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div className="eyebrow">{t('catalog.demoSection')}</div>
            <p className="mono demo-note">{t('catalog.demoNote')}</p>
            <div className="filters" style={{ margin: 0 }}>
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
              <Link to="/strategies/$id" params={{ id: s.id }} className="card" key={s.id}>
                <div className="strategy-top">
                  <div>
                    <span className="badge">{s.assets.join(' · ')}</span>
                    <h3 style={{ margin: '14px 0 4px', fontSize: 17 }}>{s.name}</h3>
                    <div className="tag">{s.tagline}</div>
                  </div>
                  <span style={{ color: s.color }}>↗</span>
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

export const Route = createFileRoute('/strategies/')({ component: Catalog });
