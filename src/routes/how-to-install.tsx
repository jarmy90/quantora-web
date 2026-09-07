import { createFileRoute } from '@tanstack/react-router';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { publicStrategies } from '../catalog';
import { t } from '../i18n';
import '../styles/app.css';

function GuideStep({
  n,
  title,
  intro,
  children,
}: {
  n: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`step-${n}`} className="card guide-step" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="step-num mono" style={{ fontSize: 15 }}>
          Step {n}
        </span>
        <h2 style={{ fontSize: 22, margin: 0 }}>{title}</h2>
      </div>
      {intro && (
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: '0 0 12px', maxWidth: 720 }}>
          {intro}
        </p>
      )}
      {children}
    </section>
  );
}

/**
 * Documented slot for an authentic MetaTrader 5 screenshot. A clearly
 * internal placeholder renders until a real capture is supplied — never a
 * simulation that could be mistaken for a live or account view.
 */
function Mt5ShotSlot({ id, label }: { id: string; label: string }) {
  return (
    <div id={id} className="mt5-shot-slot" role="img" aria-label={label}>
      <span className="slot-title">{t('easy.slotTitle')}</span>
      <p className="mono">{t('easy.slotBody')}</p>
      <p style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.6 }}>{label}</p>
    </div>
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

        <div id="steps" style={{ marginTop: 28 }}>
          {/* Step 1 · Install the EA in MetaTrader 5 */}
          <GuideStep n="1" title={t('easy.installTitle')} intro={t('easy.noCompile')}>
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

            <h3 style={{ fontSize: 16, margin: '18px 0 8px' }}>{t('easy.downloadTitle')}</h3>
            <div className="package-card" style={{ marginTop: 8 }}>
              <div className="file-row">{t('easy.packageEx5')}</div>
              <div className="file-row">{t('easy.packageSet')}</div>
              <div className="file-row">{t('easy.packageGuide')}</div>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              {t('easy.settingsNote')}
            </p>
            <p className="mono" style={{ fontSize: 12, color: 'var(--lime)' }}>
              {t('easy.downloadCta')}
            </p>

            <h3 style={{ fontSize: 16, margin: '18px 0 8px' }}>{t('easy.installTroubleTitle')}</h3>
            <OrderList
              items={[t('easy.installTrouble1'), t('easy.installTrouble2'), t('easy.installTrouble3')]}
            />

            <Mt5ShotSlot id="shot-1" label={t('easy.shotInstallAlt')} />
          </GuideStep>

          {/* Step 2 · Open the required market and timeframe */}
          <GuideStep n="2" title={t('easy.marketTitle')} intro={t('easy.marketBody')}>
            <OrderList items={[t('easy.marketStep1'), t('easy.marketStep2'), t('easy.marketStep3')]} />
            <div className="dash-table-wrap" style={{ marginTop: 14 }}>
              <table className="dash-table strategy-market-table">
                <thead>
                  <tr>
                    <th>{t('easy.marketTableStrategy')}</th>
                    <th>{t('easy.marketTableMarket')}</th>
                    <th>{t('easy.marketTableInstrument')}</th>
                    <th>{t('easy.marketTableTimeframe')}</th>
                  </tr>
                </thead>
                <tbody>
                  {publicStrategies.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.market ?? '—'}</td>
                      <td>{s.instrument ?? '—'}</td>
                      <td>{s.period?.timeframe ? s.period.timeframe : t('easy.marketNotSpecified')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mono" style={{ fontSize: 12, marginTop: 10 }}>
              {t('easy.marketNote')}
            </p>
            <Mt5ShotSlot id="shot-2" label={t('easy.shotMarketAlt')} />
          </GuideStep>

          {/* Step 3 · Attach the EA and start safely in demo */}
          <GuideStep n="3" title={t('easy.testTitle')} intro={t('easy.testIntro')}>
            <OrderList
              items={[
                t('easy.testStep3'),
                t('easy.testStep4'),
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
            <Mt5ShotSlot id="shot-3" label={t('easy.shotAttachAlt')} />
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
