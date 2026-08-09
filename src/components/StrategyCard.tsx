/**
 * Unified strategy card used on the home page, catalog and matcher results.
 * Metrics come exclusively from the profile model — no duplication in routes.
 */
import { Link } from '@tanstack/react-router';
import type { StrategyProfile } from '../domain/product';
import { useFavorites } from '../state/favorites';
import { useCompare } from '../state/compare';
import { PowerScore, StatusBadge } from './ui';
import { t } from '../i18n';

export function StrategyCard({ profile }: { profile: StrategyProfile }) {
  const favorites = useFavorites();
  const compare = useCompare();
  const m = profile.metrics;
  const favourite = favorites.isFavorite(profile.id);
  const inCompare = compare.isCompared(profile.id);

  return (
    <article className="card strategy-card">
      <Link to="/strategies/$id" params={{ id: profile.id }} className="strategy-card-main">
        <div className="strategy-top">
          <div>
            <StatusBadge status={profile.dataStatus} />
            <h3>{profile.name}</h3>
            <div className="tag">{profile.tagline}</div>
          </div>
          <PowerScore score={m.powerScore} />
        </div>
        <div className="strategy-meta">
          <span className="badge">{profile.marketContext}</span>
          <span className="badge">{profile.riskLevel} risk</span>
          <span className="badge">{profile.frequency} freq</span>
          {profile.assets.length > 0 && <span className="badge">{profile.assets.join(' · ')}</span>}
        </div>
        <div className="stats">
          <div>
            <small>{t('card.profitFactor')}</small>
            <strong>{m.profitFactor !== undefined ? m.profitFactor.toFixed(4) : '—'}</strong>
          </div>
          <div>
            <small>{t('card.trades')}</small>
            <strong>{m.tradeCount !== undefined ? m.tradeCount.toLocaleString('en-US') : '—'}</strong>
          </div>
          <div>
            <small>{t('card.netResult')}</small>
            <strong className={m.netProfitUsd !== undefined && m.netProfitUsd < 0 ? 'neg' : 'pos'}>
              {m.netProfitUsd !== undefined
                ? `${m.netProfitUsd >= 0 ? '+' : '−'}${Math.abs(m.netProfitUsd).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD`
                : '—'}
            </strong>
          </div>
        </div>
      </Link>
      <div className="strategy-card-actions">
        <button
          className={`icon-btn ${favourite ? 'active' : ''}`}
          aria-pressed={favourite}
          aria-label={favourite ? t('card.removeFavorite') : t('card.addFavorite')}
          onClick={() => favorites.toggle(profile.id)}
        >
          {favourite ? '♥' : '♡'}
        </button>
        <button
          className={`icon-btn ${inCompare ? 'active' : ''}`}
          aria-pressed={inCompare}
          disabled={!inCompare && !compare.canAdd}
          aria-label={inCompare ? t('compare.remove') : t('compare.add')}
          onClick={() => compare.toggle(profile.id)}
        >
          {inCompare ? '✓' : '+'}
        </button>
        <Link className="btn btn-sm" to="/strategies/$id" params={{ id: profile.id }}>
          {t('card.details')} →
        </Link>
      </div>
    </article>
  );
}
