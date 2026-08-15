/**
 * V2B — Single SVG chart library (no external dependency).
 *
 * One consistent, dependency-free charting approach used by every analytics
 * surface: equity curve, drawdown, monthly heatmap, mini sparklines and
 * distribution bars. Built as accessible SVG with keyboard/focus support,
 * reduced-motion friendly, and dual positive/negative color encoding
 * (never color alone — every state also has a text/icon label).
 *
 * Charts render real data when present and an honest neutral "pending" panel
 * when the series is absent. Nothing is invented.
 */
import { useState, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import type {
  EquitySeries,
  EquityRange,
  MonthlyReturns,
  NormalizedTrade,
} from '../domain/analytics';
import {
  filterByRange,
  equitySummary,
  PERFORMANCE_DISCLAIMER,
} from '../domain/analytics';

const POS = '#c9ff5a'; // lime — positive
const NEG = '#ff7185'; // red — negative
const NEUTRAL = '#72d9ff'; // cyan — neutral/info
const GRID = '#222c38';

const fmtUsd = (n: number, dp = 0) =>
  `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: dp })}`;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};

/* ------------------------- Honest pending panel ------------------------- */

export function PendingPanel({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="chart-pending" role="status" aria-live="polite">
      <div className="chart-pending-icon" aria-hidden="true">
        ◌
      </div>
      <h4>{title}</h4>
      <p className="muted">{body}</p>
      <p className="mono chart-disclaimer">{PERFORMANCE_DISCLAIMER}</p>
    </div>
  );
}

/* ------------------------------ Equity chart ------------------------------ */

type EquityChartProps = {
  series?: EquitySeries;
  color?: string;
  unit?: 'USD' | 'R';
};

export function EquityChart({ series, color = POS, unit = 'USD' }: EquityChartProps) {
  const [range, setRange] = useState<EquityRange>('ALL');
  const [unitState, setUnitState] = useState<'USD' | 'R'>(unit);
  const [toggleTrades, setToggleTrades] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const filtered = useMemo(
    () => (series && series.length ? filterByRange(series, range) : series),
    [series, range],
  );

  if (!filtered || !filtered.length) {
    return (
      <PendingPanel
        title="Equity curve — dataset unavailable"
        body="The per-trade equity series has not been delivered yet. Quantora never invents a curve: this chart will render from equity.csv as soon as the owner supplies it."
      />
    );
  }

  const W = 1000;
  const H = 320;
  const padL = 64;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const equities = filtered.map((p) => p.equity);
  let min = Math.min(...equities);
  let max = Math.max(...equities);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const yPad = (max - min) * 0.08;
  min -= yPad;
  max += yPad;
  const span = max - min;

  const x = (i: number) => padL + (i / Math.max(1, filtered.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - ((v - min) / span) * plotH;

  const path = filtered
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`)
    .join(' ');
  const areaPath = `${path} L${x(filtered.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  const summary = equitySummary(filtered);
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => min + (span * i) / ticks);

  const hoverPoint = hover !== null ? filtered[hover] : undefined;

  return (
    <div className="equity-chart-wrap">
      <div className="chart-controls">
        <div className="range-tabs" role="tablist" aria-label="Equity range">
          {(['1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as EquityRange[]).map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              className={`range-tab ${range === r ? 'active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="chart-toggles">
          <button
            className={`chart-toggle ${unitState === 'USD' ? 'active' : ''}`}
            aria-pressed={unitState === 'USD'}
            onClick={() => setUnitState('USD')}
          >
            USD
          </button>
          <button
            className={`chart-toggle ${unitState === 'R' ? 'active' : ''}`}
            aria-pressed={unitState === 'R'}
            onClick={() => setUnitState('R')}
          >
            R
          </button>
          <button
            className={`chart-toggle ${toggleTrades ? 'active' : ''}`}
            aria-pressed={toggleTrades}
            onClick={() => setToggleTrades((v) => !v)}
          >
            Trades
          </button>
        </div>
      </div>

      <div className="chart-kpis">
        <div className="chart-kpi">
          <small>Final</small>
          <strong>{summary.final !== undefined ? `${fmtUsd(summary.final)} ${unitState}` : '—'}</strong>
        </div>
        <div className="chart-kpi">
          <small>High</small>
          <strong>{summary.high !== undefined ? `${fmtUsd(summary.high)} ${unitState}` : '—'}</strong>
        </div>
        <div className="chart-kpi neg">
          <small>Worst DD</small>
          <strong>
            {summary.worstDdUsd !== undefined
              ? `${fmtUsd(summary.worstDdUsd)} ${unitState} (${((summary.worstDdPct ?? 0) * 100).toFixed(2)}%)`
              : '—'}
          </strong>
        </div>
      </div>

      <svg
        ref={svgRef}
        className="equity-chart"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Equity curve from ${fmtDate(filtered[0]!.timestamp)} to ${fmtDate(filtered[filtered.length - 1]!.timestamp)}`}
      >
        <defs>
          <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 3} textAnchor="end" fontSize="11" fill="#8e9aaa" className="mono">
              {fmtUsd(t)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#eq-fill)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.2" />
        {toggleTrades &&
          filtered.map((p, i) =>
            p.drawdownUsd !== undefined && p.drawdownUsd > 0 ? (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.equity)}
                r="2.2"
                fill={NEG}
                opacity="0.55"
              />
            ) : null,
          )}
        {hover !== null && hoverPoint && (
          <g>
            <line
              x1={x(hover)}
              y1={padT}
              x2={x(hover)}
              y2={padT + plotH}
              stroke={NEUTRAL}
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle cx={x(hover)} cy={y(hoverPoint.equity)} r="4" fill={color} stroke="#080b10" strokeWidth="2" />
          </g>
        )}
        <text x={padL} y={H - 8} fontSize="11" fill="#8e9aaa" className="mono">
          {fmtDate(filtered[0]!.timestamp)}
        </text>
        <text x={W - padR} y={H - 8} fontSize="11" fill="#8e9aaa" textAnchor="end" className="mono">
          {fmtDate(filtered[filtered.length - 1]!.timestamp)}
        </text>
      </svg>

      <div className="chart-overlay-rows" aria-hidden={hover === null}>
        {hoverPoint ? (
          <div className="chart-tooltip" role="status">
            <span className="mono">{fmtDate(hoverPoint.timestamp)}</span>
            <span>
              Equity: <strong>{fmtUsd(hoverPoint.equity, 2)} {unitState}</strong>
            </span>
            {hoverPoint.drawdownUsd !== undefined && (
              <span className={hoverPoint.drawdownUsd > 0 ? 'neg' : 'pos'}>
                DD: {fmtUsd(hoverPoint.drawdownUsd, 2)} {unitState}
                {hoverPoint.drawdownPct !== undefined ? ` (${(hoverPoint.drawdownPct * 100).toFixed(2)}%)` : ''}
              </span>
            )}
          </div>
        ) : (
          <div className="chart-tooltip muted">
            <span className="chart-hint-hover">Hover the curve to inspect a point.</span>
            <span className="chart-hint-tap">Tap the curve to inspect a point.</span>
          </div>
        )}
      </div>
      <svg
        className="equity-hover-layer"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={(e) => {
            const rect = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const i = Math.round(((px - padL) / plotW) * (filtered.length - 1));
            setHover(Math.max(0, Math.min(filtered.length - 1, i)));
          }}
          onPointerDown={(e) => {
            const rect = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const i = Math.round(((px - padL) / plotW) * (filtered.length - 1));
            setHover(Math.max(0, Math.min(filtered.length - 1, i)));
          }}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      <p className="mono chart-disclaimer">{PERFORMANCE_DISCLAIMER}</p>
    </div>
  );
}

/* ----------------------------- Drawdown chart ----------------------------- */

export function DrawdownChart({ series }: { series?: EquitySeries }) {
  if (!series || !series.length) {
    return (
      <PendingPanel
        title="Historical Drawdown — dataset unavailable"
        body="The drawdown series is derived from equity.csv. It is not invented; it will appear here when the owner delivers the per-trade equity series."
      />
    );
  }
  const W = 1000;
  const H = 200;
  const padL = 64;
  const padR = 16;
  const padT = 12;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // drawdown as negative values (0 line at top, troughs below)
  const dds = series.map((p) => {
    if (p.drawdownUsd !== undefined) return p.drawdownUsd;
    return 0;
  });
  const maxDd = Math.max(...dds, 0) || 1;
  const x = (i: number) => padL + (i / Math.max(1, series.length - 1)) * plotW;
  const y = (v: number) => padT + (v / maxDd) * plotH;

  const path = series
    .map((p, i) => {
      const v = p.drawdownUsd ?? 0;
      return `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    })
    .join(' ');
  const areaPath = `${path} L${x(series.length - 1).toFixed(1)},${padT.toFixed(1)} L${x(0).toFixed(1)},${padT.toFixed(1)} Z`;

  return (
    <div className="drawdown-chart-wrap">
      <h4 className="chart-title">Historical Drawdown</h4>
      <svg className="drawdown-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Historical drawdown over the backtest period">
        <defs>
          <linearGradient id="dd-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NEG} stopOpacity="0" />
            <stop offset="100%" stopColor={NEG} stopOpacity="0.32" />
          </linearGradient>
        </defs>
        <line x1={padL} y1={padT} x2={W - padR} y2={padT} stroke={GRID} strokeWidth="1" />
        {[0.5, 1].map((f, i) => (
          <g key={i}>
            <line x1={padL} y1={padT + plotH * f} x2={W - padR} y2={padT + plotH * f} stroke={GRID} strokeWidth="1" strokeDasharray="2 4" />
            <text x={padL - 8} y={padT + plotH * f + 3} textAnchor="end" fontSize="11" fill="#8e9aaa" className="mono">
              {fmtUsd(maxDd * f)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#dd-fill)" />
        <path d={path} fill="none" stroke={NEG} strokeWidth="2" />
        <text x={padL} y={H - 6} fontSize="11" fill="#8e9aaa" className="mono">
          {fmtDate(series[0]!.timestamp)}
        </text>
        <text x={W - padR} y={H - 6} fontSize="11" fill="#8e9aaa" textAnchor="end" className="mono">
          {fmtDate(series[series.length - 1]!.timestamp)}
        </text>
      </svg>
      <p className="mono chart-disclaimer">{PERFORMANCE_DISCLAIMER}</p>
    </div>
  );
}

/* ----------------------------- Monthly heatmap ----------------------------- */

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function MonthlyHeatmap({ monthly, trades = [] }: { monthly?: MonthlyReturns; trades?: NormalizedTrade[] }) {
  if (!monthly || !monthly.length) {
    return (
      <PendingPanel
        title="Monthly heatmap — dataset unavailable"
        body="The monthly P&L heatmap is computed from trades.csv. It is not invented; it will appear when the owner delivers the per-trade series."
      />
    );
  }
  const years = [...new Set(monthly.map((m) => m.year))].sort();
  const maxAbs = Math.max(...monthly.map((m) => Math.abs(m.pnlUsd)), 1);

  const cellColor = (pnl: number) => {
    if (pnl === 0) return 'transparent';
    const intensity = Math.min(1, Math.abs(pnl) / maxAbs);
    return pnl > 0
      ? `rgba(201,255,90,${0.18 + intensity * 0.7})`
      : `rgba(255,113,133,${0.18 + intensity * 0.7})`;
  };

  const get = (year: number, month: number) =>
    monthly.find((m) => m.year === year && m.month === month);
  const rFor = (year: number, month?: number) => trades
    .filter((trade) => {
      const date = new Date(trade.closedAt ?? trade.openedAt);
      return date.getUTCFullYear() === year && (month === undefined || date.getUTCMonth() === month);
    })
    .reduce((sum, trade) => sum + (trade.rMultiple ?? 0), 0);

  return (
    <div className="heatmap-wrap" role="region" aria-label="Monthly returns heatmap">
      <div className="heatmap-scroll">
        <table className="heatmap-table">
          <thead>
            <tr>
              <th scope="col">Year</th>
              {MONTH_LABELS.map((ml) => (
                <th key={ml} scope="col">
                  {ml}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => {
              const yearTotal = monthly
                .filter((m) => m.year === year)
                .reduce((a, m) => a + m.pnlUsd, 0);
              return (
                <tr key={year}>
                  <th scope="row">{year}</th>
                  {MONTH_LABELS.map((_, mi) => {
                    const b = get(year, mi);
                    if (!b) {
                      return (
                        <td key={mi}>
                          <span className="heatmap-empty" aria-label={`${MONTH_LABELS[mi]} ${year}: no data`}>
                            —
                          </span>
                        </td>
                      );
                    }
                    const monthR = rFor(year, mi);
                    return (
                      <td
                        key={mi}
                        style={{ background: cellColor(b.pnlUsd) }}
                        className="heatmap-cell"
                        title={`${MONTH_LABELS[mi]} ${year} · USD ${b.pnlUsd >= 0 ? '+' : '−'}${Math.abs(b.pnlUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · R ${monthR >= 0 ? '+' : '−'}${Math.abs(monthR).toFixed(2)}`}
                      >
                        <span className={b.pnlUsd >= 0 ? 'pos' : 'neg'}>
                          {b.pnlUsd >= 0 ? '+' : '−'}
                          {fmtUsd(Math.abs(b.pnlUsd))}
                        </span>
                        <span className="heatmap-meta muted">
                          {b.trades} ops · {(b.wins / Math.max(1, b.trades) * 100).toFixed(0)}% win
                        </span>
                      </td>
                    );
                  })}
                  <td className="heatmap-total" title={`${year} total · USD ${yearTotal >= 0 ? '+' : '−'}${Math.abs(yearTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · R ${rFor(year) >= 0 ? '+' : '−'}${Math.abs(rFor(year)).toFixed(2)}`}>
                    <strong className={yearTotal >= 0 ? 'pos' : 'neg'}>
                      {yearTotal >= 0 ? '+' : '−'}
                      {fmtUsd(Math.abs(yearTotal))}
                    </strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="heatmap-legend">
        <span className="heatmap-swatch" style={{ background: `rgba(201,255,90,0.6)` }} /> Positive month
        <span className="heatmap-swatch" style={{ background: `rgba(255,113,133,0.6)` }} /> Negative month
        <span className="heatmap-swatch heatmap-swatch-empty" /> No trades <span className="heatmap-tooltip-note">Hover a cell for year, month, USD and R.</span>
      </div>
      <p className="mono chart-disclaimer">{PERFORMANCE_DISCLAIMER}</p>
    </div>
  );
}

/* --------------------------- Distribution bars --------------------------- */

export function DistributionBars({
  trades,
}: {
  trades?: NormalizedTrade[];
}) {
  if (!trades || !trades.length) {
    return (
      <PendingPanel
        title="P&L distribution — dataset unavailable"
        body="The P&L distribution histogram is computed from trades.csv and will appear when the per-trade series arrive."
      />
    );
  }
  const pnls = trades.map((t) => t.pnlUsd ?? 0);
  const min = Math.min(...pnls);
  const max = Math.max(...pnls);
  if (min === max) return <p className="muted">All trades share the same P&L.</p>;
  const bins = 12;
  const step = (max - min) / bins;
  const buckets = Array.from({ length: bins }, (_, i) => {
    const lo = min + i * step;
    const hi = lo + step;
    const count = pnls.filter((p) => p >= lo && (i === bins - 1 ? p <= hi : p < hi)).length;
    return { lo, hi, count };
  });
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="dist-bars">
      {buckets.map((b, i) => {
        const mid = (b.lo + b.hi) / 2;
        const pos = mid >= 0;
        return (
          <div key={i} className="dist-bar-col" title={`${fmtUsd(b.lo, 0)} to ${fmtUsd(b.hi, 0)}: ${b.count} trades`}>
            <div className="dist-bar" style={{ height: `${(b.count / maxCount) * 100}%`, background: pos ? POS : NEG }} />
            <span className="muted">{b.count}</span>
          </div>
        );
      })}
      <p className="mono chart-disclaimer">{PERFORMANCE_DISCLAIMER}</p>
    </div>
  );
}

/* ------------------------------- Mini sparkline ------------------------------- */

export function MiniSpark({
  points,
  color,
  height = 40,
}: {
  points: number[];
  color: string;
  height?: number;
}) {
  if (!points.length) return null;
  const W = 120;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * W).toFixed(1)},${(height - ((p - min) / span) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="mini-spark" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/* ----------------------- Pending mini (no curve) ----------------------- */

export function MiniPending({ label }: { label: string }) {
  return (
    <div className="mini-pending" role="img" aria-label={`${label} — dataset unavailable`}>
      <span className="mono">unavailable</span>
    </div>
  );
}

/* ------------------------- Generic section shell ------------------------- */

export function ChartSection({
  title,
  children,
  note,
}: {
  title: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <section className="card detail-section chart-section">
      <div className="chart-section-head">
        <h3 className="chart-title">{title}</h3>
      </div>
      {children}
      {note && <p className="muted chart-section-note">{note}</p>}
    </section>
  );
}
