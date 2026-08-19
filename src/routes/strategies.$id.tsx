import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { curveFor, findStrategy, type Asset, type Strategy } from '../data';
import { findPublicStrategy } from '../catalog';
import type { PublicStrategy } from '../domain/publicStrategy';
import type { EquityPoint } from '../domain/types';
import { fmtDate, fmtNum, fmtPct, fmtPeriod, fmtSignedUsd, fmtUsd } from '../format';
import { t } from '../i18n';
import { Logo } from '../components/Logo';
import { Footer } from '../components/Footer';
import '../styles/app.css';

const CYAN = '#72d9ff';
const LIME = '#c9ff5a';
const RED = '#ff7185';

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
 * Equity-curve chart driven by the real equity points (timestamp + USD value).
 * Hovering reveals the closest point's date, equity and drawdown.
 */
function RealEquityChart({ points }: { points: EquityPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = points.length;
  if (total < 2) return <p className="muted">—</p>;

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
          {fmtDate(hoverPoint.timestamp)} · {fmtUsd(hoverPoint.equity)}
          {hoverPoint.drawdown !== undefined && ` · ${t('detail.drawdownValue')} ${fmtUsd(hoverPoint.drawdown)}`}
        </div>
      )}
    </>
  );
}

function RealDetail({ s }: { s: PublicStrategy }) {
  const m = s.metrics ?? {};
  const score = s.score;

  const cells: { label: string; value: string; accent?: string }[] = [
    { label: t('detail.score'), value: score ? String(score.value) : '—', accent: LIME },
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
      label: t('detail.maxDrawdown'),
      value: m.maxDrawdownUsd !== undefined ? `-${fmtUsd(m.maxDrawdownUsd)}` : '—',
      accent: RED,
    },
    {
      label: t('detail.costs'),
      value: m.costPerTradeUsd !== undefined ? `${fmtUsd(m.costPerTradeUsd)} / trade` : '—',
    },
    {
      label: t('detail.netResult'),
      value: m.netUsd !== undefined ? fmtSignedUsd(m.netUsd) : '—',
      accent: (m.netUsd ?? 0) >= 0 ? LIME : RED,
    },
  ];

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
            {s.version && <span className="badge">{t('detail.version')} {s.version}</span>}
            {s.market && <span className="badge">{t('detail.market')}: {s.market}</span>}
            {s.instrument && <span className="badge">{t('detail.instrument')}: {s.instrument}</span>}
            {s.period && <span className="badge">{fmtPeriod(s.period.start, s.period.end)}</span>}
          </div>
        </section>

        <section className="card chart-card">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {t('detail.equityCurve')}
          </div>
          <RealEquityChart points={s.equity?.points ?? []} />
        </section>

        <section className="metric-grid" style={{ marginTop: 15 }}>
          {cells.map((cell) => (
            <div className="metric-cell" key={cell.label}>
              <small>{cell.label}</small>
              <strong style={cell.accent ? { color: cell.accent } : undefined}>{cell.value}</strong>
            </div>
          ))}
        </section>

        <section className="card" style={{ marginTop: 15 }}>
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
          <p className="mono research-note">{t('detail.researchNote')}</p>
        </section>

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

// ---------------------------------------------------------------------------
// Mock/demo strategy detail (unchanged Phase 1 experience)
// ---------------------------------------------------------------------------

/**
 * Interactive equity-curve chart. Ranges change the sampled window (mock),
 * hovering reveals the simulated index at a given period.
 */
function Chart({ points, color }: { points: number[]; color: string }) {
  const [range, setRange] = useState('1Y');
  const [hover, setHover] = useState<number | null>(null);
  // Simulated window slicing by range (mock only — same data, different view).
  const shown = points.slice(Math.max(0, range === 'ALL' ? 0 : range === '1Y' ? 0 : range === '6M' ? Math.floor(points.length / 2) : Math.floor((points.length * 3) / 4)));
  const total = shown.length;
  const pts = shown
    .map((p, i) => `${(i / (total - 1)) * 100},${95 - (p - 20) * 1.45}`)
    .join(' ');

  const hoverIndex = hover !== null ? Math.min(shown.length - 1, hover) : null;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
          {t('detail.curve')}
        </span>
        <div>
          {['3M', '6M', '1Y', 'ALL'].map((x) => (
            <button
              key={x}
              onClick={() => setRange(x)}
              style={{
                background: range === x ? '#26333c' : 'transparent',
                color: range === x ? 'white' : 'var(--muted)',
                border: 0,
                padding: '6px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
      <svg
        className="chart"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onMouseMove={(e) =>
          setHover(
            Math.min(
              total - 1,
              Math.floor(
                (e.nativeEvent.offsetX / Math.max(1, e.currentTarget.clientWidth)) * total,
              ),
            ),
          )
        }
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor={color} stopOpacity=".22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon fill="url(#fill)" points={`0,100 ${pts} 100,100`} />
        <polyline fill="none" stroke={color} strokeWidth=".8" points={pts} />
        {hoverIndex !== null && (
          <>
            <line
              x1={(hoverIndex / (total - 1)) * 100}
              x2={(hoverIndex / (total - 1)) * 100}
              y1="5"
              y2="100"
              stroke="#ffffff66"
              strokeDasharray="2"
            />
            <circle
              cx={(hoverIndex / (total - 1)) * 100}
              cy={95 - (shown[hoverIndex] - 20) * 1.45}
              r="2"
              fill={color}
            />
          </>
        )}
      </svg>
      {hoverIndex !== null && (
        <div className="mono" style={{ fontSize: 11, color }}>
          {t('detail.period')} {hoverIndex + 1} · {t('detail.simulatedIndex')}{' '}
          {shown[hoverIndex]}
        </div>
      )}
    </>
  );
}

/** Mock buy/rent license selector — visual only, no real purchase or license. */
function LicensePicker() {
  const [model, setModel] = useState<'rent' | 'buy'>('rent');
  const options = [
    { key: 'rent' as const, label: t('detail.rent'), desc: t('detail.rentDesc'), price: t('detail.rentPrice'), unit: t('detail.perMonth') },
    { key: 'buy' as const, label: t('detail.buy'), desc: t('detail.buyDesc'), price: t('detail.buyPrice'), unit: t('detail.once') },
  ];
  return (
    <div className="license-picker">
      {options.map((o) => (
        <button
          key={o.key}
          className={`license-opt ${model === o.key ? 'active' : ''}`}
          onClick={() => setModel(o.key)}
          type="button"
        >
          <span className="license-label">{o.label}</span>
          <span className="license-desc">{o.desc}</span>
          <span className="license-price">
            {o.price} <em>{o.unit}</em>
          </span>
        </button>
      ))}
    </div>
  );
}

function MockDetail({ s }: { s: Strategy }) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const current: Asset = asset ?? s.assets[0];
  const curve = curveFor(s, current);
  const log = s.log.filter((r) => (s.assets.length > 1 ? r.asset === current : true));

  return (
    <>
      <Nav />
      <main className="wrap">
        <section className="detail-hero">
          <div className="eyebrow">{t('detail.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(34px,5vw,58px)', letterSpacing: '-.06em', margin: '15px 0 8px' }}>
            {s.name}
          </h1>
          <p className="muted">{s.description}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            {s.assets.map((a) => (
              <button
                className="badge"
                onClick={() => setAsset(a)}
                style={{
                  background: current === a ? '#263a22' : 'transparent',
                  color: current === a ? 'var(--lime)' : 'var(--muted)',
                  cursor: 'pointer',
                }}
                key={a}
              >
                {a}
              </button>
            ))}
          </div>
        </section>

        <div className="detail-layout">
          <section>
            <div className="card chart-card">
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                {t('detail.curveFor')} {current}
              </div>
              <Chart points={curve} color={s.color} />
            </div>

            <div className="card" style={{ marginTop: 15 }}>
              <div className="eyebrow">{t('detail.snapshot')}</div>
              <div className="stats" style={{ marginTop: 22 }}>
                {(
                  [
                    [t('common.demoReturn'), `+${s.returnPct}%`],
                    [t('detail.sharpe'), s.sharpe],
                    [t('detail.maxDrawdown'), s.maxDrawdown],
                    [t('detail.winRate'), s.winRate],
                    [t('detail.totalTrades'), s.trades],
                    [t('detail.dataStatus'), 'MOCK'],
                  ] as [string, string][]
                ).map(([a, b]) => (
                  <div key={a}>
                    <small>{a}</small>
                    <strong style={{ color: a === 'Data status' ? 'var(--lime)' : 'white' }}>{b}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginTop: 15, overflowX: 'auto' }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                {t('detail.tradeLog')}
                {s.assets.length > 1 && <span style={{ color: s.color, marginLeft: 8 }}>· {current}</span>}
              </div>
              <table className="log">
                <thead>
                  <tr>
                    <th>{t('detail.date')}</th>
                    <th>{t('detail.asset')}</th>
                    <th>{t('detail.side')}</th>
                    <th>{t('detail.demoPnL')}</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((r) => (
                    <tr key={`${r.date}-${r.asset}`}>
                      <td>{r.date}</td>
                      <td>{r.asset}</td>
                      <td>{r.side}</td>
                      <td style={{ color: r.pnl.startsWith('-') ? 'var(--red)' : 'var(--lime)' }}>
                        {r.pnl}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="card buy">
            <div className="eyebrow">{t('detail.access')}</div>
            <h2 style={{ fontSize: 23 }}>{t('detail.model')}</h2>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              {t('detail.modelBody')}
            </p>

            <label className="tag" style={{ display: 'block', margin: '14px 0 8px' }}>
              {t('detail.licenseOption')}
            </label>
            <LicensePicker />

            <label className="tag" style={{ display: 'block', margin: '16px 0 8px' }}>
              {t('detail.allocation')}
            </label>
            <input className="input" value="$10,000" readOnly />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 18 }}>
              <span className="muted">{t('detail.fee')}</span>
              <span>{s.fee} / year</span>
            </div>
            <button
              className="btn primary"
              style={{ width: '100%' }}
              onClick={() => alert(t('detail.alert'))}
            >
              {t('detail.simulate')}
            </button>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Detail() {
  const { id } = Route.useParams();

  const real = findPublicStrategy(id);
  if (real) return <RealDetail s={real} />;

  const mock = findStrategy(id);
  if (mock) return <MockDetail s={mock} />;

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

export const Route = createFileRoute('/strategies/$id')({ component: Detail });
