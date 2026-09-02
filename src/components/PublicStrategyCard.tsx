import { Link } from '@tanstack/react-router';
import type { PublicStrategy } from '../domain/publicStrategy';
import { fmtNum, fmtPoints, fmtSignedPoints, fmtSignedUsd, fmtUsd } from '../format';
import { t } from '../i18n';

/**
 * Small equity sparkline generated from the real equity points (never invented).
 */
export function EquitySpark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const poly = points
    .map((p, i) => `${(i / (points.length - 1)) * 300},${65 - ((p - min) / range) * 55}`)
    .join(' ');
  return (
    <svg className="curve" viewBox="0 0 300 65" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="var(--cyan)" strokeWidth="2" points={poly} />
    </svg>
  );
}

export function productStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'available':
      return t('catalog.available');
    case 'paused':
      return t('catalog.paused');
    case 'deprecated':
      return t('catalog.deprecated');
    case 'coming_soon':
      return t('catalog.commercialOpeningSoon');
    default:
      return t('catalog.commercialOpeningSoon');
  }
}

/**
 * Public strategy card. `cta` renders an explicit "View strategy" action (home);
 * without it the whole card links to the detail page (catalog).
 *
 * QNT-0020: cost treatment is never a badge on the card. When costs are not
 * applied, a discreet typographic note appears after the metrics and before
 * the CTA — no alert icon, no caps, no highlighted border.
 */
export function PublicStrategyCard({ s, cta = false }: { s: PublicStrategy; cta?: boolean }) {
  const m = s.metrics ?? {};
  const curve = s.equity?.points.map((p) => p.equity) ?? [];
  const score = s.score?.value;
  const pointsUnit = s.performanceUnit === 'points';
  const net = pointsUnit ? m.netPoints : m.netUsd;
  const dd = pointsUnit ? m.maxDrawdownPoints : m.maxDrawdownUsd;

  const netValue =
    net !== undefined
      ? pointsUnit
        ? fmtSignedPoints(net)
        : fmtSignedUsd(net)
      : '—';
  const ddValue =
    dd !== undefined
      ? `${pointsUnit ? fmtPoints(dd) : fmtUsd(dd)}${
          m.closedTradeDrawdownDecimal !== undefined
            ? ` · ${(m.closedTradeDrawdownDecimal * 100).toFixed(2)}%`
            : ''
        }`
      : '—';

  const inner = (
    <>
      <div className="strategy-top">
        <div>
          <span className="badge">
            {t('catalog.publishedStrategy')}
            {s.market ? ` · ${s.market}` : ''}
            {s.instrument ? ` · ${s.instrument}` : ''}
          </span>
          <h3 style={{ margin: '14px 0 4px', fontSize: 17 }}>{s.name}</h3>
          <div className="tag">{s.tagline}</div>
          {s.version && (
            <div className="tag" style={{ marginTop: 4 }}>
              v{s.version}
            </div>
          )}
          <div className="card-chips">
            <span className="status-chip published">{t('catalog.publishedStrategy')}</span>
            <span className="status-chip historical">{t('catalog.historicalBacktest')}</span>
          </div>
        </div>
        <span style={{ color: 'var(--cyan)', fontSize: 20 }} aria-hidden="true">
          ↗
        </span>
      </div>
      <EquitySpark points={curve} />
      <div className="stats">
        <div>
          <small>{t('detail.netResult')}</small>
          <strong style={{ color: net !== undefined && net > 0 ? 'var(--green)' : undefined }}>
            {netValue}
          </strong>
        </div>
        <div>
          <small>{t('detail.profitFactor')}</small>
          <strong>{m.profitFactor !== undefined ? m.profitFactor.toFixed(2) : '—'}</strong>
        </div>
        <div>
          <small>{t('detail.score')}</small>
          <strong style={{ color: 'var(--lime)' }}>
            {score ?? '—'}
          </strong>
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
          <strong style={{ color: 'var(--amber)' }}>{ddValue}</strong>
        </div>
      </div>
      {s.costsApplied === false && <p className="cost-note">{t('card.costsNotIncluded')}</p>}
    </>
  );

  if (cta) {
    return (
      <div className="card real-card" key={s.id}>
        {inner}
        <Link className="btn primary card-cta" to="/strategies/$id" params={{ id: s.id }}>
          {t('home.viewStrategy')} →
        </Link>
      </div>
    );
  }
  return (
    <Link to="/strategies/$id" params={{ id: s.id }} className="card real-card" key={s.id}>
      {inner}
    </Link>
  );
}
