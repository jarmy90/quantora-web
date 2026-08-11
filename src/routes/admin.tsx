import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useSession, RequireRole, ROLE_LABEL } from '../auth/session';
import type { Role } from '../auth/session';
import { profiles } from '../domain/product';
import { analyticsForProfile } from '../domain/strategy-analytics';
import { previewCsv, detectEntity, withinPreviewLimits, type CsvParseResult } from '../domain/csv-import';
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

  // V2B — evidence import status per strategy.
  const evidenceRows = profiles.map((p) => {
    const a = analyticsForProfile(p);
    return {
      id: p.id,
      name: p.name,
      series: a.evidence.hasSeries ? 'delivered' : 'pending',
      economic: a.economic,
    };
  });

  // V2B — admin CSV preview (read-only, in-browser, nothing stored).
  const [csvName, setCsvName] = useState('');
  const [csvText, setCsvText] = useState('');
  const csvPreview: CsvParseResult<unknown> | null = useMemo(() => {
    if (!csvText.trim()) return null;
    const entity = detectEntity(csvName) ?? 'trades';
    const res = previewCsv(entity, csvText);
    const limit = withinPreviewLimits(csvText, res.rawRowCount);
    if (limit) return { rows: [], errors: [{ row: 0, message: limit }], rawRowCount: res.rawRowCount };
    return res;
  }, [csvText, csvName]);

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

        <section className="card" style={{ marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            {t('admin.evidence')}
          </div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
            {t('admin.evidenceNote')}
          </p>
          <div className="dash-table-wrap">
            <table className="log dash-table">
              <thead>
                <tr>
                  <th>{t('admin.colName')}</th>
                  <th>{t('admin.colSeries')}</th>
                  <th>{t('admin.colAggregates')}</th>
                  <th>{t('admin.colScore')}</th>
                </tr>
              </thead>
              <tbody>
                {evidenceRows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{r.name}</td>
                    <td>
                      <span className={`badge ${r.series === 'delivered' ? 'badge-lime' : 'badge-amber'}`}>
                        {r.series === 'delivered' ? t('admin.seriesDelivered') : t('admin.seriesPending')}
                      </span>
                    </td>
                    <td className="muted mono" style={{ fontSize: 11 }}>
                      {r.economic?.profitFactor !== undefined ? `PF ${r.economic.profitFactor.toFixed(4)}` : '—'}
                      {r.economic?.netProfitUsd !== undefined ? ` · net ${r.economic.netProfitUsd} USD` : ''}
                    </td>
                    <td className="mono">{profiles.find((p) => p.id === r.id)!.metrics.powerScore.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="csv-preview-block" style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>{t('publish.csvPreview')}</h3>
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              {t('publish.csvPreviewHint')}
            </p>
            <input
              className="input"
              value={csvName}
              onChange={(e) => setCsvName(e.target.value)}
              placeholder="e.g. trades.csv"
              aria-label="CSV filename for entity detection"
            />
            <textarea
              className="input csv-textarea"
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'id,side,openedAt,symbol,quantity,entryPrice,pnlUsd,structural\nt1,buy,2025-08-01T09:30:00Z,USTEC,1,18000.5,120.5,win'}
              aria-label={t('publish.csvPreview')}
            />
            {csvPreview ? (
              <div className="csv-preview-result">
                <div className="csv-preview-stats">
                  <span className="badge badge-cyan">{t('publish.csvParsed')}: {csvPreview.rawRowCount}</span>
                  <span className="badge badge-lime">{t('publish.csvValidRows')}: {csvPreview.rows.length}</span>
                  <span className="badge badge-red">{t('publish.csvInvalidRows')}: {Math.max(0, csvPreview.rawRowCount - csvPreview.rows.length)}</span>
                </div>
                {csvPreview.errors.length > 0 && (
                  <ul className="csv-errors">
                    {csvPreview.errors.slice(0, 15).map((e, i) => (
                      <li key={i} className="mono">
                        {e.row > 0 ? `row ${e.row}` : 'header'}{e.column ? ` · ${e.column}` : ''}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('publish.csvNoFile')}</p>
            )}
          </div>
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
