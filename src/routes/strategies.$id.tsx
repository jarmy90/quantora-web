import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { findProfile } from '../domain/product';
import { analyticsForProfile } from '../domain/strategy-analytics';
import {
  filterTrades,
  sortTrades,
  paginate,
  type TradeSortKey,
  type SortDir,
  PERFORMANCE_DISCLAIMER,
} from '../domain/analytics';
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
  Badge,
} from '../components/ui';
import {
  EquityChart,
  DrawdownChart,
  MonthlyHeatmap,
  DistributionBars,
  ChartSection,
  PendingPanel,
} from '../components/charts';
import { useFavorites } from '../state/favorites';
import { useCompare } from '../state/compare';
import { track, ANALYTICS_ACTIONS } from '../analytics/analytics';
import '../styles/app.css';

type TabId = 'overview' | 'performance' | 'trades' | 'how' | 'evidence';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: t('detail.tabOverview') },
  { id: 'performance', label: t('detail.tabPerformance') },
  { id: 'trades', label: t('detail.tabTrades') },
  { id: 'how', label: t('detail.tabHowItWorks') },
  { id: 'evidence', label: t('detail.tabEvidence') },
];

const PAGE_SIZE = 12;

function Disclaimer() {
  return <p className="mono chart-disclaimer">{PERFORMANCE_DISCLAIMER}</p>;
}

function StructuralVsEconomic({
  profile,
  analytics,
  onExpand,
}: {
  profile: ReturnType<typeof findProfile> & object;
  analytics: ReturnType<typeof analyticsForProfile>;
  onExpand: () => void;
}) {
  const sf = profile.structuralFacts;
  const ec = analytics.economic;
  if (!sf) {
    return (
      <ChartSection title={t('detail.structuralVsEconomic')}>
        <p className="muted">No structural outcome rules were supplied for this strategy.</p>
        <Disclaimer />
      </ChartSection>
    );
  }
  const total = sf.winCount + sf.lossCount;
  const winRate = total > 0 ? (sf.winCount / total) * 100 : 0;
  return (
    <ChartSection
      title={t('detail.structuralVsEconomic')}
      note="Structural outcome (WIN/LOSS by rule) is tracked separately from economic result (post-cost P&L). A structural WIN can still lose money after execution costs."
    >
      <div className="se-grid">
        <div className="se-col">
          <h4 className="se-head">{t('detail.structural')}</h4>
          <div className="se-stats">
            <div className="se-stat pos">
              <small>Structural WIN</small>
              <strong>{sf.winCount}</strong>
            </div>
            <div className="se-stat neg">
              <small>Structural LOSS</small>
              <strong>{sf.lossCount}</strong>
            </div>
            <div className="se-stat">
              <small>Win rate (by rule)</small>
              <strong>{winRate.toFixed(1)}%</strong>
            </div>
          </div>
          <p className="muted se-rule"><strong>WIN rule:</strong> {sf.winRule}</p>
          <p className="muted se-rule"><strong>LOSS rule:</strong> {sf.lossRule}</p>
        </div>
        <div className="se-col">
          <h4 className="se-head">{t('detail.economic')}</h4>
          <div className="se-stats">
            <div className="se-stat">
              <small>Net result</small>
              <strong className={(ec?.netProfitUsd ?? 0) >= 0 ? 'pos' : 'neg'}>
                {ec?.netProfitUsd !== undefined
                  ? `${ec.netProfitUsd >= 0 ? '+' : '−'}${Math.abs(ec.netProfitUsd).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD`
                  : '—'}
              </strong>
            </div>
            <div className="se-stat">
              <small>Profit factor</small>
              <strong>{ec?.profitFactor !== undefined ? ec.profitFactor.toFixed(4) : '—'}</strong>
            </div>
            <div className="se-stat">
              <small>Avg / operation</small>
              <strong className={(ec?.avgPerTradeUsd ?? 0) >= 0 ? 'pos' : 'neg'}>
                {ec?.avgPerTradeUsd !== undefined
                  ? `${ec.avgPerTradeUsd >= 0 ? '+' : '−'}${Math.abs(ec.avgPerTradeUsd).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD`
                  : '—'}
              </strong>
            </div>
          </div>
          <p className="muted se-rule">
            Economic result is the realized P&L after execution costs; it can diverge from the structural WIN/LOSS count.
          </p>
        </div>
      </div>
      <button className="btn btn-sm se-expand" onClick={onExpand} aria-expanded={false}>
        {t('detail.structuralVsEconomic')} →
      </button>
      <Disclaimer />
    </ChartSection>
  );
}

function ScheduleFacts({ profile }: { profile: ReturnType<typeof findProfile> & object }) {
  const sch = profile.scheduleFacts;
  if (!sch) return null;
  return (
    <ChartSection title={`${t('detail.schedule')} (${sch.timezone})`}>
      <div className="schedule-grid">
        <div>
          <h4 className="se-head pos">{t('detail.scheduleAllowed')}</h4>
          <ul className="plain-list">
            {sch.allowed.map((s, i) => (
              <li key={i}>
                <span className="mono">{s.start}–{s.end}</span> {sch.timezone}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="se-head neg">{t('detail.scheduleExcluded')}</h4>
          <ul className="plain-list warn">
            {sch.excluded.map((s, i) => (
              <li key={i}>
                <span className="mono">{s.start}–{s.end}</span> {sch.timezone}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ChartSection>
  );
}

function TradeLog({
  analytics,
}: {
  analytics: ReturnType<typeof analyticsForProfile>;
}) {
  const [query, setQuery] = useState('');
  const [side, setSide] = useState<'all' | 'buy' | 'sell'>('all');
  const [sortKey, setSortKey] = useState<TradeSortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  const trades = analytics.trades;
  const filtered = useMemo(() => {
    if (!trades) return [];
    return sortTrades(filterTrades(trades, query, side), sortKey, sortDir);
  }, [trades, query, side, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = paginate(filtered, safePage, PAGE_SIZE);

  if (!trades || !trades.length) {
    return (
      <ChartSection title={t('detail.tradeLog')}>
        <PendingPanel
          title="Trade log — pending dataset"
          body="The per-trade log is sourced from trades.csv. Quantora never invents trades; the log will appear here when the owner delivers the per-trade series."
        />
      </ChartSection>
    );
  }

  return (
    <ChartSection title={t('detail.tradeLog')}>
      <div className="tradelog-controls">
        <input
          className="input tradelog-search"
          placeholder={t('detail.tradeSearch')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
            track({ category: 'engagement', action: ANALYTICS_ACTIONS.filterTradeLog, label: 'query' });
          }}
          aria-label={t('detail.tradeSearch')}
        />
        <select
          className="select"
          value={side}
          onChange={(e) => {
            setSide(e.target.value as 'all' | 'buy' | 'sell');
            setPage(1);
            track({ category: 'engagement', action: ANALYTICS_ACTIONS.filterTradeLog, label: 'side' });
          }}
          aria-label="Filter by side"
        >
          <option value="all">All sides</option>
          <option value="buy">BUY</option>
          <option value="sell">SELL</option>
        </select>
        <select
          className="select"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as TradeSortKey)}
          aria-label="Sort key"
        >
          <option value="date">Date</option>
          <option value="pnl">P&L</option>
          <option value="symbol">Symbol</option>
          <option value="side">Side</option>
        </select>
        <select
          className="select"
          value={sortDir}
          onChange={(e) => setSortDir(e.target.value as SortDir)}
          aria-label="Sort direction"
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="muted">{t('detail.tradeEmpty')}</p>
      ) : (
        <>
          <div className="dash-table-wrap">
            <table className="log dash-table tradelog-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Opened</th>
                  <th>Closed</th>
                  <th>Side</th>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>P&L (USD / R)</th>
                  <th>Structural</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((tr) => (
                  <tr key={tr.id} title={`Exit: ${tr.exitReason ?? 'not supplied'} · R: ${tr.rMultiple ?? 'not supplied'}${tr.riskPoints ? ` · initial risk: ${tr.riskPoints} points` : ''}`}>
                    <td className="mono">{tr.id}</td>
                    <td>{tr.openedAt.slice(0, 16).replace('T', ' ')}</td>
                    <td>{tr.closedAt ? tr.closedAt.slice(0, 16).replace('T', ' ') : '—'}</td>
                    <td>
                      <Badge tone={tr.side === 'buy' ? 'lime' : 'red'}>{tr.side.toUpperCase()}</Badge>
                    </td>
                    <td>{tr.symbol}</td>
                    <td className="mono">{tr.quantity}</td>
                    <td className="mono">{tr.entryPrice}</td>
                    <td className="mono">{tr.exitPrice ?? '—'}</td>
                    <td className={`mono ${(tr.pnlUsd ?? 0) >= 0 ? 'pos' : 'neg'}`}>
                      {tr.pnlUsd !== undefined
                        ? `${tr.pnlUsd >= 0 ? '+' : '−'}${Math.abs(tr.pnlUsd).toFixed(2)}`
                        : '—'}
                    </td>
                    <td>{tr.structural ? <Badge tone={tr.structural === 'win' ? 'lime' : 'red'}>{tr.structural.toUpperCase()}</Badge> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tradelog-pager">
            <button
              className="btn btn-sm"
              disabled={safePage <= 1}
              onClick={() => {
                setPage(safePage - 1);
                track({ category: 'engagement', action: ANALYTICS_ACTIONS.paginateTradeLog, label: 'prev' });
              }}
            >
              ← Prev
            </button>
            <span className="muted mono">
              {t('detail.tradePage')} {safePage} {t('detail.tradeOf')} {pageCount} · {filtered.length} trades
            </span>
            <button
              className="btn btn-sm"
              disabled={safePage >= pageCount}
              onClick={() => {
                setPage(safePage + 1);
                track({ category: 'engagement', action: ANALYTICS_ACTIONS.paginateTradeLog, label: 'next' });
              }}
            >
              Next →
            </button>
          </div>
        </>
      )}
      <Disclaimer />
    </ChartSection>
  );
}

function SecondaryModules({
  analytics,
}: {
  analytics: ReturnType<typeof analyticsForProfile>;
}) {
  const dir = analytics.direction;
  const dur = analytics.duration;
  const conc = analytics.concentration;
  const stk = analytics.streaks;
  const trades = analytics.trades ?? [];
  const wins = trades.filter((t) => (t.pnlUsd ?? 0) > 0).length;
  const losses = trades.filter((t) => (t.pnlUsd ?? 0) < 0).length;
  const be = trades.filter((t) => (t.pnlUsd ?? 0) === 0).length;

  return (
    <div className="secondary-modules">
      <ChartSection title={t('detail.pnlDistribution')}>
        <DistributionBars trades={trades} />
      </ChartSection>
      <ChartSection title={t('detail.direction')}>
        {dir ? (
          <div className="se-stats">
            <div className="se-stat pos"><small>BUY</small><strong>{dir.buyCount}</strong></div>
            <div className="se-stat neg"><small>SELL</small><strong>{dir.sellCount}</strong></div>
            {dir.buyPnlUsd !== undefined && (
              <div className="se-stat"><small>BUY P&L</small><strong className={dir.buyPnlUsd >= 0 ? 'pos' : 'neg'}>{dir.buyPnlUsd >= 0 ? '+' : '−'}{Math.abs(dir.buyPnlUsd).toFixed(0)}</strong></div>
            )}
            {dir.sellPnlUsd !== undefined && (
              <div className="se-stat"><small>SELL P&L</small><strong className={dir.sellPnlUsd >= 0 ? 'pos' : 'neg'}>{dir.sellPnlUsd >= 0 ? '+' : '−'}{Math.abs(dir.sellPnlUsd).toFixed(0)}</strong></div>
            )}
          </div>
        ) : (
          <PendingPanel title="BUY / SELL — pending dataset" body="Direction breakdown is computed from trades.csv and will appear when the series arrive." />
        )}
      </ChartSection>
      <ChartSection title={t('detail.winLossBreakeven')}>
        {trades.length ? (
          <div className="se-stats">
            <div className="se-stat pos"><small>Wins</small><strong>{wins}</strong></div>
            <div className="se-stat neg"><small>Losses</small><strong>{losses}</strong></div>
            <div className="se-stat"><small>Breakeven</small><strong>{be}</strong></div>
          </div>
        ) : (
          <PendingPanel title="Win / Loss / Breakeven — pending dataset" body="Counts are computed from trades.csv and will appear when the series arrive." />
        )}
      </ChartSection>
      <ChartSection title={t('detail.duration')}>
        {dur && dur.avgDurationMinutes !== undefined ? (
          <div className="se-stats">
            <div className="se-stat"><small>Avg (min)</small><strong>{dur.avgDurationMinutes.toFixed(1)}</strong></div>
            <div className="se-stat"><small>Shortest (min)</small><strong>{dur.shortestMinutes?.toFixed(1) ?? '—'}</strong></div>
            <div className="se-stat"><small>Longest (min)</small><strong>{dur.longestMinutes?.toFixed(1) ?? '—'}</strong></div>
          </div>
        ) : (
          <PendingPanel title="Trade duration — pending dataset" body="Duration statistics are computed from trades.csv open/close timestamps." />
        )}
      </ChartSection>
      <ChartSection title={t('detail.concentration')}>
        {conc && conc.top5.length ? (
          <div className="concentration-list">
            <h4 className="se-head">Top 5 by |P&L|</h4>
            <ul className="plain-list">
              {conc.top5.map((c) => (
                <li key={c.label}>
                  <span className="mono">{c.label}</span> — {c.trades} ops ·{' '}
                  <span className={c.pnlUsd >= 0 ? 'pos' : 'neg'}>
                    {c.pnlUsd >= 0 ? '+' : '−'}{Math.abs(c.pnlUsd).toFixed(0)} USD
                  </span>
                </li>
              ))}
            </ul>
            {conc.bestTradeUsd !== undefined && (
              <p className="muted">
                Best trade: <span className="pos">+{conc.bestTradeUsd.toFixed(0)}</span> · Worst trade:{' '}
                <span className="neg">{conc.worstTradeUsd?.toFixed(0)}</span>
              </p>
            )}
          </div>
        ) : (
          <PendingPanel title="Concentration — pending dataset" body="Top-N concentration is computed from trades.csv and will appear when the series arrive." />
        )}
      </ChartSection>
      <ChartSection title={t('detail.streaks')}>
        {stk ? (
          <div className="se-stats">
            <div className="se-stat pos"><small>Max win streak</small><strong>{stk.maxWinStreak}</strong></div>
            <div className="se-stat neg"><small>Max loss streak</small><strong>{stk.maxLossStreak}</strong></div>
            <div className="se-stat"><small>Current</small><strong>{stk.currentStreak > 0 ? `+${stk.currentStreak}` : stk.currentStreak < 0 ? `${stk.currentStreak}` : '0'}</strong></div>
          </div>
        ) : (
          <PendingPanel title="Streaks — pending dataset" body="Streak statistics are computed from trades.csv and will appear when the series arrive." />
        )}
      </ChartSection>
    </div>
  );
}

function Detail() {
  const { id } = useParams({ from: '/strategies/$id' });
  const profile = findProfile(id);
  const favorites = useFavorites();
  const compare = useCompare();
  const [tab, setTab] = useState<TabId>('overview');

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
  const analytics = analyticsForProfile(profile);

  const selectTab = (next: TabId) => {
    setTab(next);
    track({ category: 'navigation', action: ANALYTICS_ACTIONS.openPerformanceTab, label: next });
  };

  return (
    <>
      <Seo
        title={`${profile.name} — Quantora`}
        description={`${profile.tagline}. Power Score ${m.powerScore.toFixed(1)}/10. ${
          isReal ? 'Historical backtest metrics provided by the owner.' : 'Mock demo data.'
        } Not investment advice.`}
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
                {isReal && <Badge tone="cyan">{t('detail.historicalBacktest')}</Badge>}
              </div>
              <h1 style={{ fontSize: 'clamp(32px,5vw,54px)', letterSpacing: '-.05em', margin: '16px 0 6px' }}>
                {profile.name}
              </h1>
              {profile.positioning && (
                <p className="mono" style={{ color: 'var(--lime)', fontSize: 14, margin: '0 0 8px' }}>
                  {profile.positioning}
                </p>
              )}
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

        <Disclaimer />

        <nav className="detail-tabs" role="tablist" aria-label="Strategy sections">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              role="tab"
              aria-selected={tab === tb.id}
              className={`detail-tab ${tab === tb.id ? 'active' : ''}`}
              onClick={() => selectTab(tb.id)}
            >
              {tb.label}
            </button>
          ))}
        </nav>

        <div className="detail-layout">
          <div>
            {tab === 'overview' && (
              <>
                <ChartSection title={isReal ? t('detail.metrics') : t('detail.metrics')}>
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
                </ChartSection>
                {profile.datasetStatusNote && (
                  <ChartSection title={t('detail.datasetPending')}>
                    <p className="muted" style={{ lineHeight: 1.7 }}>
                      {profile.datasetStatusNote}
                    </p>
                  </ChartSection>
                )}
                <ChartSection title={t('detail.howItWorks')}>
                  <ol className="steps-list">
                    {profile.howItWorks.map((step, i) => (
                      <li key={i}>
                        <span className="step-num mono">{String(i + 1).padStart(2, '0')}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </ChartSection>
                {profile.structuralFacts && (
                  <StructuralVsEconomic
                    profile={profile}
                    analytics={analytics}
                    onExpand={() =>
                      track({ category: 'engagement', action: ANALYTICS_ACTIONS.expandStructuralEconomic, label: profile.id })
                    }
                  />
                )}
                {profile.scheduleFacts && <ScheduleFacts profile={profile} />}
              </>
            )}

            {tab === 'performance' && (
              <>
                <ChartSection title={t('detail.performanceHero')}>
                  <EquityChart series={analytics.equity} color={profile.color} />
                </ChartSection>
                <ChartSection title={t('detail.drawdown')}>
                  <DrawdownChart series={analytics.drawdown} />
                </ChartSection>
                <ChartSection title={t('detail.monthlyHeatmap')}>
                  <MonthlyHeatmap monthly={analytics.monthly} />
                </ChartSection>
                {profile.structuralFacts && (
                  <StructuralVsEconomic
                    profile={profile}
                    analytics={analytics}
                    onExpand={() =>
                      track({ category: 'engagement', action: ANALYTICS_ACTIONS.expandStructuralEconomic, label: profile.id })
                    }
                  />
                )}
                <SecondaryModules analytics={analytics} />
              </>
            )}

            {tab === 'trades' && <TradeLog analytics={analytics} />}

            {tab === 'how' && (
              <>
                <ChartSection title={t('detail.howItWorks')}>
                  <ol className="steps-list">
                    {profile.howItWorks.map((step, i) => (
                      <li key={i}>
                        <span className="step-num mono">{String(i + 1).padStart(2, '0')}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </ChartSection>
                <ChartSection title={t('detail.dimensions')}>
                  <DimensionBars dimensions={profile.dimensions} />
                  <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
                    {t('detail.dimensionsNote')}
                  </p>
                </ChartSection>
                <ChartSection title={t('detail.methodology')}>
                  <ul className="plain-list">
                    {profile.methodology.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </ChartSection>
                <ChartSection title={t('detail.limitations')}>
                  <ul className="plain-list warn">
                    {profile.limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </ChartSection>
              </>
            )}

            {tab === 'evidence' && (
              <>
                <ChartSection title={t('detail.evidence')}>
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
                </ChartSection>
                {profile.datasetStatusNote && (
                  <ChartSection title={t('detail.datasetPending')}>
                    <p className="muted" style={{ lineHeight: 1.7 }}>
                      {profile.datasetStatusNote}
                    </p>
                  </ChartSection>
                )}
                <ChartSection title="Provenance">
                  <p className="muted">
                    Source label: <strong>{isReal ? t('detail.historicalBacktest') : 'Mock demo'}</strong>
                    {profile.evidenceSource && <> · discrete evidence: <strong>{profile.evidenceSource}</strong></>}
                  </p>
                </ChartSection>
                <div className="card score-card">
                  <PowerScoreExplain />
                </div>
              </>
            )}
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
