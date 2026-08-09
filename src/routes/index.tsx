import { createFileRoute, Link } from '@tanstack/react-router';
import { profiles } from '../domain/product';
import { t } from '../i18n';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { StrategyCard } from '../components/StrategyCard';
import { PowerScoreExplain, SectionTitle, EducationBlock, Seo } from '../components/ui';
import '../styles/app.css';

const EDU_ITEMS = [
  {
    title: 'What is a backtest?',
    body: 'A simulation of how a strategy would have behaved on historical data. Useful for research — never a guarantee of what happens next.',
  },
  {
    title: 'Why drawdown matters',
    body: 'Drawdown is how much your equity falls from a peak. If you cannot tolerate the historical drawdown, the strategy is likely a poor fit for you.',
  },
  {
    title: 'Profit factor, simply',
    body: 'Gross profit divided by gross loss. Above 1.0 the strategy made more than it lost in the sample; 1.25 is generally considered healthy.',
  },
  {
    title: 'Sample size and trust',
    body: 'A 145-operation sample tells you less than 421. The more operations and the deeper the data, the more you can learn — and the more you should still doubt.',
  },
];

function Home() {
  const featured = profiles.filter((p) => p.dataStatus === 'real');

  return (
    <>
      <Seo
        title="Quantora — Algorithmic strategy discovery & evaluation"
        description="Discover and evaluate algorithmic MetaTrader 5 strategies with transparent, auditable Power Scores. Demo product — not investment advice."
      />
      <Nav
        extra={
          <>
            <a href="#power-score">{t('nav.powerScore')}</a>
            <a href="#learn">{t('nav.learn')}</a>
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
            <Link className="btn" to="/matcher">
              {t('home.matcherCta')}
            </Link>
            <Link className="btn" to="/publish">
              {t('home.publishCta')}
            </Link>
          </div>
          <p className="mono" style={{ fontSize: 11, marginTop: 28, color: '#65717d' }}>
            {t('home.mockNotice')}
          </p>
        </section>

        <section className="section wrap">
          <SectionTitle eyebrow={t('home.curated')} title={t('home.signals')} body={t('home.startingPoint')} />
          <div className="grid" style={{ marginTop: 25 }}>
            {featured.map((p) => (
              <StrategyCard key={p.id} profile={p} />
            ))}
          </div>
        </section>

        <section id="power-score" className="section wrap">
          <SectionTitle eyebrow={t('home.scoreEyebrow')} title={t('home.scoreTitle')} body={t('home.scoreBody')} />
          <div className="card score-card">
            <PowerScoreExplain />
            <div className="actions" style={{ marginTop: 16 }}>
              <Link className="btn" to="/strategies">
                {t('catalog.title')} →
              </Link>
            </div>
          </div>
        </section>

        <section id="learn" className="section wrap">
          <SectionTitle eyebrow={t('home.learnEyebrow')} title={t('home.learnTitle')} body={t('home.learnBody')} />
          <EducationBlock items={EDU_ITEMS} />
        </section>

        <section id="trust" className="section wrap">
          <div className="card" style={{ borderColor: '#34472a', background: '#101710' }}>
            <div className="eyebrow">{t('trust.eyebrow')}</div>
            <h2 style={{ fontSize: 24 }}>{t('trust.title')}</h2>
            <p className="muted" style={{ maxWidth: 700, lineHeight: 1.7 }}>
              {t('trust.body')}
            </p>
            <div className="actions">
              <Link className="btn primary" to="/publish">
                {t('home.publishCta')} →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/')({ component: Home });
