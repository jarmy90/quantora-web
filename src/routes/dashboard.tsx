import { createFileRoute, Link } from '@tanstack/react-router';
import { activity, downloads, licenses, type DashboardLicense } from '../data';
import { findProfile } from '../domain/product';
import { useFavorites } from '../state/favorites';
import { t } from '../i18n';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { EmptyState, Seo } from '../components/ui';
import '../styles/app.css';
const statusColor: Record<DashboardLicense['status'], string> = {
  Active: 'var(--lime)',
  Trial: 'var(--cyan)',
  Expired: 'var(--red)',
};
function Licenses() {
  if (licenses.length === 0) {
    return <p className="muted">{t('dashboard.emptyLicenses')}</p>;
  }
  return (
    <div className="dash-table-wrap">
      <table className="log dash-table">
        <thead>
          <tr>
            <th>{t('nav.strategies')}</th>
            <th>{t('dashboard.type')}</th>
            <th>{t('dashboard.status')}</th>
            <th>{t('dashboard.expires')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {licenses.map((l) => (
            <tr key={l.id}>
              <td style={{ fontWeight: 700 }}>{l.strategyName}</td>
              <td>{l.type}</td>
              <td>
                <span className="mono" style={{ color: statusColor[l.status] }}>
                  {l.status}
                </span>
              </td>
              <td className="muted">{l.expires}</td>
              <td>
                <Link
                  to="/strategies/$id"
                  params={{ id: l.strategyId }}
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
  if (downloads.length === 0) {
    return <p className="muted">{t('dashboard.emptyDownloads')}</p>;
  }
  return (
    <div className="dash-table-wrap">
      <table className="log dash-table">
        <thead>
          <tr>
            <th>{t('dashboard.name')}</th>
            <th>{t('dashboard.format')}</th>
            <th>{t('dashboard.size')}</th>
            <th>{t('dashboard.date')}</th>
          </tr>
        </thead>
        <tbody>
          {downloads.map((d) => (
            <tr key={d.id}>
              <td style={{ fontWeight: 700 }}>{d.name}</td>
              <td className="muted">{d.format}</td>
              <td className="muted">{d.size}</td>
              <td className="muted">{d.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function History() {
  if (activity.length === 0) {
    return <p className="muted">{t('dashboard.emptyHistory')}</p>;
  }
  return (
    <ul className="dash-timeline">
      {activity.map((a) => (
        <li key={a.id}>
          <span className="dash-dot" />
          <div>
            <strong style={{ fontSize: 14 }}>{a.label}</strong>
            <div className="muted" style={{ fontSize: 12, margin: '2px 0' }}>
              {a.detail}
            </div>
            <div className="mono" style={{ fontSize: 11, color: '#65717d' }}>
              {a.date}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
function Favorites() {
  const { ids } = useFavorites();
  const items = ids.map((id) => findProfile(id)).filter((p) => p !== undefined);
  if (items.length === 0) {
    return (
      <EmptyState
        title={t('dashboard.emptyFavorites')}
        body={t('dashboard.emptyFavoritesBody')}
        action={
          <Link className="btn" to="/strategies">
            {t('home.browse')} →
          </Link>
        }
      />
    );
  }
  return (
    <div className="dash-table-wrap">
      <table className="log dash-table">
        <thead>
          <tr>
            <th>{t('nav.strategies')}</th>
            <th>{t('common.powerScore')}</th>
            <th>{t('common.risk')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 700 }}>{p.name}</td>
              <td className="mono">{p.metrics.powerScore.toFixed(1)} / 10</td>
              <td className="muted">{p.riskLevel}</td>
              <td>
                <Link to="/strategies/$id" params={{ id: p.id }} className="dash-link">
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
function Dashboard() {
  return (
    <>
      <Seo
        title="Your workspace — Quantora"
        description="Demo workspace: favorites, licenses, downloads and activity. Nothing here is real — no authentication or payments."
      />
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
            ♥ {t('dashboard.favorites')}
          </div>
          <Favorites />
        </section>
        <section className="card" style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            {t('dashboard.licenses')}
          </div>
          <Licenses />
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
export const Route = createFileRoute('/dashboard')({ component: Dashboard });
