import { createFileRoute } from '@tanstack/react-router';
import { useSession, RequireRole, ROLE_LABEL } from '../auth/session';
import type { Role } from '../auth/session';
import { profiles } from '../domain/product';
import { useDrafts } from '../state/drafts';
import { t } from '../i18n';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { Seo } from '../components/ui';
import '../styles/app.css';

/**
 * Admin base — Phase 1 scaffold only.
 *  - Protected by role (RequireRole) and NOT linked from any public page.
 *  - There is no real authentication; the demo switcher below exists solely so
 *    the role gate can be previewed. Swap SessionProvider for a real auth
 *    provider later without touching this route.
 *  - No moderation or publishing actions exist: the review queue reads local
 *    drafts and displays status only.
 */
const ROLES: Role[] = ['visitor', 'user', 'creator', 'admin'];

function AdminPanel() {
  const { role, setRole } = useSession();
  const { drafts } = useDrafts();
  const realCount = profiles.filter((p) => p.dataStatus === 'real').length;
  const mockCount = profiles.length - realCount;
  const inReview = drafts.filter((d) => d.status === 'review').length;

  return (
    <>
      <Seo
        title="Admin — Quantora (demo)"
        description="Role-protected admin base (demo). Not linked from public navigation."
      />
      <Nav />
      <main className="wrap" style={{ paddingBottom: 90 }}>
        <section className="catalog-head">
          <div className="eyebrow">{t('admin.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', letterSpacing: '-.06em', margin: '15px 0' }}>
            {t('admin.title')}
          </h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            {t('admin.body')}
          </p>
        </section>

        <div className="card" style={{ borderColor: '#3a4a5a', background: '#0d141d', marginBottom: 20 }}>
          <p className="mono" style={{ fontSize: 12, color: 'var(--cyan)', margin: 0 }}>
            ◉ {t('admin.demoNotice')} — {t('admin.role')}: <strong>{ROLE_LABEL[role]}</strong>
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {ROLES.map((r) => (
              <button
                key={r}
                className={`btn btn-sm ${role === r ? 'primary' : ''}`}
                onClick={() => setRole(r)}
                aria-pressed={role === r}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, margin: '12px 0 0' }}>
            {t('admin.demoSwitcherNote')}
          </p>
        </div>

        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="card stat-card">
            <strong>{profiles.length}</strong>
            <span className="muted">{t('admin.statStrategies')}</span>
          </div>
          <div className="card stat-card">
            <strong>{realCount}</strong>
            <span className="muted">{t('admin.statReal')}</span>
          </div>
          <div className="card stat-card">
            <strong>{mockCount}</strong>
            <span className="muted">{t('admin.statMock')}</span>
          </div>
          <div className="card stat-card">
            <strong>{drafts.length}</strong>
            <span className="muted">{t('admin.statDrafts')}</span>
          </div>
          <div className="card stat-card">
            <strong>{inReview}</strong>
            <span className="muted">{t('admin.statReview')}</span>
          </div>
        </div>

        <section className="card" style={{ marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            {t('admin.queue')}
          </div>
          {drafts.length === 0 ? (
            <p className="muted">{t('admin.queueEmpty')}</p>
          ) : (
            <div className="dash-table-wrap">
              <table className="log dash-table">
                <thead>
                  <tr>
                    <th>{t('admin.colName')}</th>
                    <th>{t('admin.colStatus')}</th>
                    <th>{t('admin.colUpdated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.basics.name || t('creator.untitled')}</td>
                      <td>
                        <span className="mono" style={{ color: d.status === 'review' ? 'var(--lime)' : 'var(--cyan)' }}>
                          {d.status}
                        </span>
                      </td>
                      <td className="muted">{new Date(d.updatedAt).toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
            {t('admin.queueNote')}
          </p>
        </section>

        <section className="card">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            {t('admin.catalog')}
          </div>
          <div className="dash-table-wrap">
            <table className="log dash-table">
              <thead>
                <tr>
                  <th>{t('admin.colName')}</th>
                  <th>{t('admin.colScore')}</th>
                  <th>{t('admin.colStatus')}</th>
                  <th>{t('admin.colRisk')}</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.name}</td>
                    <td className="mono">{p.metrics.powerScore.toFixed(1)}</td>
                    <td>{p.dataStatus}</td>
                    <td className="muted">{p.riskLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function AdminRoute() {
  return (
    <RequireRole
      allowed={['admin']}
      denied={
        <>
          <Nav />
          <main className="wrap catalog-head">
            <div className="card" style={{ marginTop: 40, maxWidth: 520 }}>
              <div className="eyebrow">ADMIN</div>
              <h1 style={{ fontSize: 24 }}>{t('admin.deniedTitle')}</h1>
              <p className="muted" style={{ lineHeight: 1.7 }}>
                {t('admin.deniedBody')}
              </p>
              <p className="mono" style={{ fontSize: 11, color: '#65717d' }}>
                {t('admin.deniedNote')}
              </p>
            </div>
          </main>
          <Footer />
        </>
      }
    >
      <AdminPanel />
    </RequireRole>
  );
}

export const Route = createFileRoute('/admin')({ component: AdminRoute });
