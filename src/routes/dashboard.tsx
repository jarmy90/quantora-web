import { createFileRoute, Link } from '@tanstack/react-router';
import { publicStrategies } from '../catalog';
import { productStatusLabel } from '../components/PublicStrategyCard';
import { t } from '../i18n';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import '../styles/app.css';

/**
 * Illustrative customer preview only. Every strategy is shown with its real
 * public product state (coming_soon), licenseStatus=not_active and
 * demoMonitoring=not_connected. No active licenses, payments or dates are
 * invented anywhere on this page.
 */
function ProductPreview() {
  if (publicStrategies.length === 0) {
    return <p className="muted">{t('dashboard.emptyLicenses')}</p>;
  }
  return (
    <div className="dash-table-wrap">
      <table className="log dash-table">
        <thead>
          <tr>
            <th>{t('nav.strategies')}</th>
            <th>{t('dashboard.product')}</th>
            <th>{t('dashboard.status')}</th>
            <th>{t('dashboard.monitor')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {publicStrategies.map((s) => (
            <tr key={s.id}>
              <td style={{ fontWeight: 700 }}>{s.name}</td>
              <td className="muted">{s.productId ?? '—'}</td>
              <td>
                <span className="status-chip commercial-soon">{productStatusLabel(s.productStatus)}</span>
              </td>
              <td>
                <span className="mono" style={{ color: 'var(--muted)' }}>
                  {t('detail.monitorNotConnected')}
                </span>
              </td>
              <td>
                <Link
                  to="/strategies/$id"
                  params={{ id: s.id }}
                  className="dash-link"
                >
                  {t('dashboard.viewStrategy')} ↗
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DownloadsList() {
  return <p className="muted">{t('dashboard.emptyDownloads')}</p>;
}

function History() {
  return <p className="muted">{t('dashboard.emptyHistory')}</p>;
}

function Dashboard() {
  return (
    <>
      <Nav />
      <main className="wrap">
        <section className="catalog-head">
          <div className="eyebrow">{t('dashboard.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(34px,5vw,56px)', letterSpacing: '-.06em', margin: '15px 0' }}>
            {t('dashboard.title')}
          </h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            {t('dashboard.body')}
          </p>
        </section>

        <div className="card" style={{ borderColor: '#3a4a5a', background: '#0d141d', marginBottom: 22 }}>
          <p className="mono" style={{ fontSize: 12, color: 'var(--cyan)', margin: 0 }}>
            ◉ {t('dashboard.demo')}
          </p>
        </div>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            {t('dashboard.licenses')}
          </div>
          <ProductPreview />
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            {t('dashboard.accountAccess')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="status-chip not-connected">{t('dashboard.notEnabledYet')}</span>
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6, maxWidth: 640 }}>
              {t('dashboard.accountAccessBody')}
            </p>
          </div>
        </section>

        <section className="card" style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            {t('dashboard.downloads')}
          </div>
          <DownloadsList />
        </section>

        <section className="card" style={{ marginBottom: 70 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            {t('dashboard.history')}
          </div>
          <History />
        </section>
      </main>
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/dashboard')({
  head: () => ({
    meta: [
      { title: 'Quantora — Dashboard preview' },
      { name: 'description', content: t('seo.dashboardDescription') },
      { property: 'og:title', content: 'Quantora — Dashboard preview' },
      { property: 'og:description', content: t('seo.dashboardDescription') },
    ],
  }),
  component: Dashboard,
});
