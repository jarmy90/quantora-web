import { createFileRoute } from '@tanstack/react-router';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { EasyStartSteps, EasyVisual } from '../components/EasyStartSteps';
import { t } from '../i18n';
import '../styles/app.css';

function GuideStep({
  n,
  title,
  visualStep,
  children,
}: {
  n: string;
  title: string;
  visualStep: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <section id={`step-${n}`} className="card guide-step" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <span className="step-num mono" style={{ fontSize: 15 }}>
          Step {n}
        </span>
        <h2 style={{ fontSize: 22, margin: 0 }}>{title}</h2>
      </div>
      {children}
      <div style={{ marginTop: 16 }}>
        <EasyVisual step={visualStep} />
      </div>
    </section>
  );
}

function OrderList({ items }: { items: string[] }) {
  return (
    <ol className="easy-ol">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="easy-check" aria-label={t('easy.checklistTitle')}>
      {items.map((item) => (
        <li key={item}>{item} ✓</li>
      ))}
    </ul>
  );
}

function HowToInstall() {
  return (
    <>
      <Nav />
      <main className="wrap" style={{ paddingTop: 40 }}>
        <section className="easy-hero">
          <div className="eyebrow">{t('easy.eyebrow')}</div>
          <h1 style={{ fontSize: 40, letterSpacing: '-.04em', lineHeight: 1.1, maxWidth: 760 }}>
            {t('easy.title')}
          </h1>
          <p className="muted" style={{ fontSize: 17, lineHeight: 1.7, maxWidth: 680 }}>
            {t('easy.body')}
          </p>
          <a className="btn primary" href="#steps" style={{ marginTop: 20 }}>
            {t('easy.cta')} ↓
          </a>
          <ul className="easy-trust" style={{ marginTop: 26 }}>
            {[t('easy.trustNoCoding'), t('easy.trustVisualGuide'), t('easy.trustDemo'), t('easy.trustMT5')].map((p) => (
              <li key={p} className="badge">
                ✓ {p}
              </li>
            ))}
          </ul>
          <p className="mono" style={{ fontSize: 10.5, marginTop: 20, color: 'var(--amber)' }}>
            {t('easy.warning')}
          </p>
        </section>

        <EasyStartSteps mode="full" />

        <div id="steps" style={{ marginTop: 34 }}>
          {/* Step 1 · Download */}
          <GuideStep n="1" title={t('easy.downloadTitle')} visualStep={1}>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.65, maxWidth: 720 }}>
              {t('easy.downloadBody')}
            </p>
            <div className="package-card" style={{ marginTop: 14 }}>
              <div className="file-row">{t('easy.packageEx5')}</div>
              <div className="file-row">{t('easy.packageSet')}</div>
              <div className="file-row">{t('easy.packageGuide')}</div>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              {t('easy.settingsNote')}
            </p>
            <p className="mono" style={{ fontSize: 12, color: 'var(--lime)' }}>
              {t('easy.noCompile')}
            </p>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
              {t('easy.downloadCta')}
            </p>
          </GuideStep>

          {/* Step 2 · Install in MT5 */}
          <GuideStep n="2" title={t('easy.installTitle')} visualStep={2}>
            <OrderList
              items={[
                t('easy.installStep1'),
                t('easy.installStep2'),
                t('easy.installStep3'),
                t('easy.installStep4'),
                t('easy.installStep5'),
                t('easy.installStep6'),
                t('easy.installStep7'),
                t('easy.installStep8'),
              ]}
            />
            <div className="path-chip mono">{t('easy.installPath')}</div>
            <div style={{ marginTop: 14 }}>
              <h3 style={{ fontSize: 16, margin: '0 0 8px' }}>{t('easy.installTroubleTitle')}</h3>
              <OrderList
                items={[t('easy.installTrouble1'), t('easy.installTrouble2'), t('easy.installTrouble3')]}
              />
            </div>
          </GuideStep>

          {/* Step 3 · Test in demo */}
          <GuideStep n="3" title={t('easy.testTitle')} visualStep={3}>
            <OrderList
              items={[
                t('easy.testStep1'),
                t('easy.testStep2'),
                t('easy.testStep3'),
                t('easy.testStep4'),
                t('easy.testStep5'),
                t('easy.testStep6'),
                t('easy.testStep7'),
                t('easy.testStep8'),
              ]}
            />
            <h3 style={{ fontSize: 16, margin: '18px 0 10px' }}>{t('easy.checklistTitle')}</h3>
            <CheckList
              items={[
                t('easy.checklistNavigator'),
                t('easy.checklistInstrument'),
                t('easy.checklistTimeframe'),
                t('easy.checklistSettings'),
                t('easy.checklistAlgo'),
                t('easy.checklistDemo'),
              ]}
            />
            <p className="mono" style={{ fontSize: 12.5, color: 'var(--amber)' }}>
              {t('easy.demoWarning')}
            </p>
          </GuideStep>
        </div>
      </main>
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/how-to-install')({
  head: () => ({
    meta: [
      { title: 'How to install a trading strategy in MetaTrader 5 | Quantora' },
      { name: 'description', content: 'Learn how to install a compiled Expert Advisor in MetaTrader 5, attach it to a chart and start safely with a demo account.' },
      { property: 'og:title', content: 'How to install a trading strategy in MetaTrader 5 | Quantora' },
      { property: 'og:description', content: 'Learn how to install a compiled Expert Advisor in MetaTrader 5, attach it to a chart and start safely with a demo account.' },
    ],
  }),
  component: HowToInstall,
});
