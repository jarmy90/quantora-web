import { createFileRoute, Link } from '@tanstack/react-router';
import { strategies } from '../data';
import { t } from '../i18n';
import { Nav } from '../components/Nav';
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

function StrategyCard({ s }: { s: (typeof strategies)[number] }) {
  return (
    <Link to="/strategies/$id" params={{ id: s.id }} className="card">
      <div className="strategy-top">
        <div>
          <span className="badge">{s.type}</span>
          <h3 style={{ margin: '14px 0 4px', fontSize: 17 }}>{s.name}</h3>
          <div className="tag">{s.tagline}</div>
        </div>
        <span style={{ color: s.color, fontSize: 20 }}>↗</span>
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
  );
}

function Home() {
  return (
    <>
      <Nav
        extra={
          <>
            <a href="#how">{t('nav.howItWorks')}</a>
            <a href="#trust">{t('nav.trustRisk')}</a>
          </>
        }
      />
      <main>
        <section className="wrap hero">
          <div className="eyebrow">{t('home.eyebrow')}</div>
          <h1>
            {t('home.heroTitle')}
            <br />
            <span style={{ color: 'var(--lime)' }}>{t('home.heroAccent')}</span>
          </h1>
          <p>{t('home.heroBody')}</p>
          <div className="actions">
            <Link className="btn primary" to="/strategies">
              {t('home.browse')}
            </Link>
            <a className="btn" href="#how">
              {t('home.seeHow')}
            </a>
          </div>
          <p className="mono" style={{ fontSize: 11, marginTop: 28, color: '#65717d' }}>
            {t('home.mockNotice')}
          </p>
        </section>

        <section className="section wrap">
          <div className="eyebrow">{t('home.curated')}</div>
          <h2>{t('home.signals')}</h2>
          <p className="muted">{t('home.startingPoint')}</p>
          <div className="grid" style={{ marginTop: 25 }}>
            {strategies.slice(0, 3).map((s) => (
              <StrategyCard key={s.id} s={s} />
            ))}
          </div>
        </section>

        <section id="how" className="section wrap">
          <div className="eyebrow">{t('home.workflow')}</div>
          <h2>{t('home.workflowTitle')}</h2>
          <div className="steps" style={{ marginTop: 25 }}>
            {[
              ['01', 'home.stepExplore', 'home.stepExploreBody'],
              ['02', 'home.stepInspect', 'home.stepInspectBody'],
              ['03', 'home.stepDecide', 'home.stepDecideBody'],
            ].map(([n, title, body]) => (
              <div className="card" key={n}>
                <div className="step-num mono">{n}</div>
                <h3>{t(title as Parameters<typeof t>[0])}</h3>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {t(body as Parameters<typeof t>[0])}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="trust" className="section wrap">
          <div className="card" style={{ borderColor: '#34472a', background: '#101710' }}>
            <div className="eyebrow">{t('trust.eyebrow')}</div>
            <h2 style={{ fontSize: 24 }}>{t('trust.title')}</h2>
            <p className="muted" style={{ maxWidth: 700, lineHeight: 1.7 }}>
              {t('trust.body')}
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/')({ component: Home });
