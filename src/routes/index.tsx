import { createFileRoute, Link } from '@tanstack/react-router';
import { publicStrategies } from '../catalog';
import { PublicStrategyCard } from '../components/PublicStrategyCard';
import { t } from '../i18n';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import '../styles/app.css';

function Home() {
  return (
    <>
      <Nav />
      <main>
        <section className="wrap hero">
          <div className="eyebrow">{t('home.eyebrow')}</div>
          <h1>
            {t('home.heroTitle')}
            <br />
            <span style={{ color: 'var(--lime)' }}>{t('home.heroAccent')}</span>
          </h1>
          <p className="hero-body">{t('home.heroBody')}</p>
          <div className="actions">
            <Link className="btn primary" to="/strategies">
              {t('home.browse')}
            </Link>
            <a className="btn" href="#compare">
              {t('home.seeHow')}
            </a>
            <Link className="btn btn-tertiary" to="/register">
              {t('nav.createAccount')}
            </Link>
          </div>

          <div className="fact-band">
            <div className="fact-item">
              <span className="fact-dot" aria-hidden="true" />
              <span>{t('home.fact1')}</span>
            </div>
            <div className="fact-item">
              <span className="fact-dot" aria-hidden="true" />
              <span>{t('home.fact2')}</span>
            </div>
            <div className="fact-item">
              <span className="fact-dot" aria-hidden="true" />
              <span>{t('home.fact3')}</span>
            </div>
            <div className="fact-item">
              <span className="fact-dot" aria-hidden="true" />
              <span>{t('home.fact4')}</span>
            </div>
          </div>
        </section>

        {publicStrategies.length > 0 && (
          <section id="catalog" className="section wrap">
            <div className="eyebrow">{t('home.realStrategies')}</div>
            <h2>{t('catalog.title')}</h2>
            <p className="section-intro">{t('home.realStrategiesBody')}</p>
            <div className="grid" style={{ marginTop: 25 }}>
              {publicStrategies.map((s) => (
                <PublicStrategyCard key={s.id} s={s} cta />
              ))}
            </div>
            <div style={{ marginTop: 24 }}>
              <Link className="btn primary" to="/strategies">
                {t('home.compare')} →
              </Link>
            </div>
          </section>
        )}

        <section id="compare" className="section wrap">
          <div className="eyebrow">{t('home.compareEyebrow')}</div>
          <h2>{t('home.compareTitle')}</h2>
          <p className="section-intro">{t('home.compareBody')}</p>
          <div className="steps" style={{ marginTop: 28 }}>
            {[
              ['01', 'home.stepAnalyze', 'home.stepAnalyzeBody'],
              ['02', 'home.stepFilter', 'home.stepFilterBody'],
              ['03', 'home.stepShow', 'home.stepShowBody'],
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
          <div className="workflow-close">
            <p>{t('home.workflowClose')}</p>
          </div>
        </section>

        <section className="section wrap easy-home">
          <div className="eyebrow">{t('easy.homeEyebrow')}</div>
          <h2>{t('easy.homeTitle')}</h2>
          <p className="section-intro">{t('easy.homeBody')}</p>
          <div className="steps" style={{ marginTop: 28 }}>
            {[
              ['01', 'easy.homeStep1', 'easy.downloadTitle'],
              ['02', 'easy.homeStep2', 'easy.installTitle'],
              ['03', 'easy.homeStep3', 'easy.testTitle'],
            ].map(([n, title, body]) => (
              <div className="card easy-step-card" key={n}>
                <div className="step-num mono">{n}</div>
                <h3 style={{ fontSize: 17, margin: '10px 0 4px' }}>{t(title as Parameters<typeof t>[0])}</h3>
                <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                  {t(body as Parameters<typeof t>[0])}
                </p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22 }}>
            <Link className="btn primary" to="/how-to-install">
              {t('easy.homeCta')} →
            </Link>
          </div>
        </section>

        <section id="waitlist" className="section wrap">
          <div className="card" style={{ borderColor: '#34472a', background: '#101710' }}>
            <div className="eyebrow">{t('home.waitlistEyebrow')}</div>
            <h2 style={{ fontSize: 24 }}>{t('home.waitlistTitle')}</h2>
            <p className="muted" style={{ maxWidth: 760, lineHeight: 1.7 }}>
              {t('home.waitlistBody')}
            </p>
            <div className="actions">
              <Link className="btn primary" to="/register">
                {t('home.getAccessUpdates')}
              </Link>
            </div>
            <p className="mono research-note">{t('home.waitlistNote')}</p>
          </div>
        </section>

        <section id="trust" className="section wrap">
          <div className="card" style={{ borderColor: '#34472a', background: '#101710' }}>
            <div className="eyebrow">{t('trust.eyebrow')}</div>
            <h2 style={{ fontSize: 24 }}>{t('trust.title')}</h2>
            <p className="muted" style={{ maxWidth: 760, lineHeight: 1.7 }}>
              {t('trust.body')}
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Quantora — Expert Advisors you can understand' },
      { name: 'description', content: t('seo.homeDescription') },
      { property: 'og:title', content: 'Quantora — Expert Advisors you can understand' },
      { property: 'og:description', content: t('seo.homeDescription') },
    ],
  }),
  component: Home,
});
