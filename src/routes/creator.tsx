import { createFileRoute, Link } from '@tanstack/react-router';
import { useDrafts } from '../state/drafts';
import { LOCAL_PERSISTENCE_NOTICE } from '../state/storage';
import { t } from '../i18n';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { EmptyState, Seo } from '../components/ui';
import '../styles/app.css';

function Creator() {
  const { drafts, deleteDraft } = useDrafts();

  return (
    <>
      <Seo
        title="Creator area — Quantora"
        description="Manage your strategy drafts. Drafts are private and stored locally in your browser — nothing is published automatically."
      />
      <Nav />
      <main className="wrap" style={{ paddingBottom: 90 }}>
        <section className="catalog-head">
          <div className="eyebrow">{t('creator.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', letterSpacing: '-.06em', margin: '15px 0' }}>
            {t('creator.title')}
          </h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            {t('creator.body')}
          </p>
          <div className="actions" style={{ marginTop: 18 }}>
            <Link className="btn primary" to="/publish">
              {t('creator.newStrategy')} →
            </Link>
          </div>
          <p className="mono" style={{ fontSize: 11, color: '#65717d', marginTop: 14 }}>
            {LOCAL_PERSISTENCE_NOTICE}
          </p>
        </section>

        {drafts.length === 0 ? (
          <EmptyState
            title={t('creator.emptyTitle')}
            body={t('creator.emptyBody')}
            action={
              <Link className="btn primary" to="/publish">
                {t('creator.newStrategy')} →
              </Link>
            }
          />
        ) : (
          <div className="draft-list">
            {drafts
              .slice()
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .map((d) => (
                <div className="card draft-row" key={d.id}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>
                      {d.basics.name || t('creator.untitled')}
                      {d.status === 'review' && <span className="badge" style={{ marginLeft: 8 }}> {t('creator.inReview')}</span>}
                    </h3>
                    <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
                      {d.basics.market || '—'} · {d.basics.approach || '—'}
                    </p>
                    <p className="mono" style={{ fontSize: 11, color: '#65717d', margin: '6px 0 0' }}>
                      {t('creator.updated')} {new Date(d.updatedAt).toLocaleString('en-US')}
                    </p>
                  </div>
                  <div className="draft-actions">
                    <Link className="btn btn-sm" to="/publish" search={{ draft: d.id }}>
                      {t('creator.resume')} →
                    </Link>
                    <button className="btn btn-sm" onClick={() => deleteDraft(d.id)}>
                      {t('creator.delete')}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

export const Route = createFileRoute('/creator')({ component: Creator });
