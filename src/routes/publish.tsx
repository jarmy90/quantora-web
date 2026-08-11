import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import type { PublishDraft } from '../domain/publish';
import { CONSENT_STATEMENTS, emptyDraft, validateStep } from '../domain/publish';
import { useDrafts } from '../state/drafts';
import { LOCAL_PERSISTENCE_NOTICE } from '../state/storage';
import { previewCsv, detectEntity, withinPreviewLimits, type CsvParseResult } from '../domain/csv-import';
import { t } from '../i18n';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { DropZone, Field, ProgressSteps, Seo } from '../components/ui';
import { track } from '../analytics/analytics';
import '../styles/app.css';

const STEPS = [t('publish.stepBasics'), t('publish.stepEvidence'), t('publish.stepFiles'), t('publish.stepConsent'), t('publish.stepDone')];

type PublishSearch = { draft?: string };

export const Route = createFileRoute('/publish')({
  validateSearch: (search: Record<string, unknown>): PublishSearch => ({
    draft: typeof search.draft === 'string' ? search.draft : undefined,
  }),
  component: Publish,
});

function Publish() {
  const { draft: draftParam } = useSearch({ from: '/publish' });
  const { getDraft, saveDraft } = useDrafts();

  const [draft, setDraft] = useState<PublishDraft>(() => emptyDraft());
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [finished, setFinished] = useState(false);

  // Load an existing draft once (resume) or register a brand-new draft for autosave.
  useEffect(() => {
    const existing = draftParam ? getDraft(draftParam) : undefined;
    const next = existing ? { ...existing } : emptyDraft();
    setDraft(next);
    saveDraft(next);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftParam]);

  const patch = (partial: Partial<PublishDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...partial, updatedAt: new Date().toISOString() };
      saveDraft(next);
      return next;
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  const patchBasics = (field: keyof PublishDraft['basics'], value: string) =>
    patch({ basics: { ...draft.basics, [field]: value } });
  const patchEvidence = (field: keyof PublishDraft['evidence'], value: string) =>
    patch({ evidence: { ...draft.evidence, [field]: value } });

  const goNext = () => {
    const errs = validateStep(draft, draft.step);
    if (errs.length > 0) {
      setErrors(errs);
      track({ category: 'wizard', action: 'validation_error', label: `step_${draft.step}` });
      return;
    }
    setErrors([]);
    if (draft.step === STEPS.length - 2) {
      // Final step of the wizard: mark finished (still private, local only).
      setFinished(true);
      track({ category: 'wizard', action: 'completed', label: draft.id });
    } else {
      patch({ step: draft.step + 1 });
    }
  };

  const goBack = () => {
    setErrors([]);
    patch({ step: Math.max(0, draft.step - 1) });
  };

  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message;

  /** V2B CSV preview state — validation runs in-browser, nothing is uploaded. */
  const [csvName, setCsvName] = useState('');
  const [csvText, setCsvText] = useState('');
  const csvPreview: CsvParseResult<unknown> | null = useMemo(() => {
    if (!csvText.trim()) return null;
    const entity = detectEntity(csvName) ?? 'trades';
    const res = previewCsv(entity, csvText);
    const limit = withinPreviewLimits(csvText, res.rawRowCount);
    if (limit) {
      return { rows: [], errors: [{ row: 0, message: limit }], rawRowCount: res.rawRowCount };
    }
    return res;
  }, [csvText, csvName]);

  if (!loaded) {
    return (
      <>
        <Nav />
        <main className="wrap catalog-head">
          <p className="muted">{t('common.loading')}</p>
        </main>
      </>
    );
  }

  const isDone = draft.step >= STEPS.length - 1 || finished;

  return (
    <>
      <Seo
        title="Publish your strategy — Quantora"
        description="Draft and submit your algorithmic strategy for review. Drafts stay private in your browser — nothing is published automatically. Demo flow."
      />
      <Nav />
      <main className="wrap" style={{ paddingBottom: 90 }}>
        <section className="catalog-head">
          <div className="eyebrow">{t('publish.eyebrow')}</div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', letterSpacing: '-.06em', margin: '15px 0' }}>
            {t('publish.title')}
          </h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            {t('publish.body')}
          </p>
          <div className="autosave" role="status">
            <span className={`autosave-dot ${savedFlash ? 'flash' : ''}`} />{' '}
            {savedFlash ? t('publish.saved') : t('publish.autosave')}
            <span className="mono muted" style={{ marginLeft: 10 }}>
              {LOCAL_PERSISTENCE_NOTICE}
            </span>
          </div>
        </section>

        <ProgressSteps steps={STEPS} current={Math.min(draft.step, STEPS.length - 1)} />

        {!isDone && (
          <div className="publish-step">
            {draft.step === 0 && (
              <div className="card">
                <h2 style={{ fontSize: 20 }}>{t('publish.stepBasics')}</h2>
                <Field id="name" label={t('publish.name')} hint={t('publish.nameHint')} error={errorFor('name')}>
                  <input
                    id="name"
                    className="input"
                    value={draft.basics.name}
                    onChange={(e) => patchBasics('name', e.target.value)}
                    placeholder={t('publish.namePlaceholder')}
                  />
                </Field>
                <Field id="tagline" label={t('publish.tagline')} hint={t('publish.taglineHint')} error={errorFor('tagline')}>
                  <input
                    id="tagline"
                    className="input"
                    value={draft.basics.tagline}
                    onChange={(e) => patchBasics('tagline', e.target.value)}
                    placeholder={t('publish.taglinePlaceholder')}
                  />
                </Field>
                <div className="form-grid">
                  <Field id="market" label={t('publish.market')} error={errorFor('market')}>
                    <input
                      id="market"
                      className="input"
                      value={draft.basics.market}
                      onChange={(e) => patchBasics('market', e.target.value)}
                      placeholder={t('publish.marketPlaceholder')}
                    />
                  </Field>
                  <Field id="approach" label={t('publish.approach')} error={errorFor('approach')}>
                    <input
                      id="approach"
                      className="input"
                      value={draft.basics.approach}
                      onChange={(e) => patchBasics('approach', e.target.value)}
                      placeholder={t('publish.approachPlaceholder')}
                    />
                  </Field>
                </div>
                <Field id="description" label={t('publish.description')} hint={t('publish.descriptionHint')}>
                  <textarea
                    id="description"
                    className="input"
                    rows={4}
                    value={draft.basics.description}
                    onChange={(e) => patchBasics('description', e.target.value)}
                    placeholder={t('publish.descriptionPlaceholder')}
                  />
                </Field>
              </div>
            )}

            {draft.step === 1 && (
              <div className="card">
                <h2 style={{ fontSize: 20 }}>{t('publish.stepEvidence')}</h2>
                <p className="muted" style={{ fontSize: 13 }}>
                  {t('publish.evidenceNote')}
                </p>
                <div className="form-grid">
                  <Field id="profitFactor" label={t('publish.pf')} error={errorFor('profitFactor')}>
                    <input
                      id="profitFactor"
                      className="input"
                      inputMode="decimal"
                      value={draft.evidence.profitFactor}
                      onChange={(e) => patchEvidence('profitFactor', e.target.value)}
                      placeholder="1.25"
                    />
                  </Field>
                  <Field id="tradeCount" label={t('publish.trades')} error={errorFor('tradeCount')}>
                    <input
                      id="tradeCount"
                      className="input"
                      inputMode="numeric"
                      value={draft.evidence.tradeCount}
                      onChange={(e) => patchEvidence('tradeCount', e.target.value)}
                      placeholder="145"
                    />
                  </Field>
                  <Field id="netProfitUsd" label={t('publish.net')} hint={t('publish.optional')} error={errorFor('netProfitUsd')}>
                    <input
                      id="netProfitUsd"
                      className="input"
                      inputMode="decimal"
                      value={draft.evidence.netProfitUsd}
                      onChange={(e) => patchEvidence('netProfitUsd', e.target.value)}
                      placeholder="6687.50"
                    />
                  </Field>
                  <Field id="maxDrawdownUsd" label={t('publish.dd')} hint={t('publish.optional')}>
                    <input
                      id="maxDrawdownUsd"
                      className="input"
                      inputMode="decimal"
                      value={draft.evidence.maxDrawdownUsd}
                      onChange={(e) => patchEvidence('maxDrawdownUsd', e.target.value)}
                      placeholder="4474.80"
                    />
                  </Field>
                </div>
                <Field id="period" label={t('publish.period')} hint={t('publish.optional')}>
                  <input
                    id="period"
                    className="input"
                    value={draft.evidence.period}
                    onChange={(e) => patchEvidence('period', e.target.value)}
                    placeholder="2025-08-01 → 2026-08-07"
                  />
                </Field>
              </div>
            )}

            {draft.step === 2 && (
              <div className="card">
                <h2 style={{ fontSize: 20 }}>{t('publish.stepFiles')}</h2>
                <p className="muted" style={{ fontSize: 13 }}>
                  {t('publish.filesNote')}
                </p>
                <DropZone
                  onFiles={(files) =>
                    patch({
                      files: [
                        ...draft.files,
                        ...files.map((f) => ({ id: `${Date.now()}-${f.name}`, ...f })),
                      ],
                    })
                  }
                />
                {errorFor('files') && (
                  <span className="field-error" role="alert">
                    {errorFor('files')}
                  </span>
                )}
                {draft.files.length > 0 && (
                  <ul className="file-list">
                    {draft.files.map((f) => (
                      <li key={f.id}>
                        <span className="file-icon" aria-hidden="true">
                          📄
                        </span>
                        <span>
                          <strong>{f.name}</strong>
                          <span className="muted" style={{ fontSize: 11, display: 'block' }}>
                            {(f.size / 1024).toFixed(1)} KB · {f.kind || 'file'}
                          </span>
                        </span>
                        <button
                          className="btn btn-sm"
                          aria-label={t('publish.removeFile')}
                          onClick={() => patch({ files: draft.files.filter((x) => x.id !== f.id) })}
                        >
                          {t('publish.removeFile')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="csv-preview-block">
                  <h3 style={{ fontSize: 16, margin: '18px 0 4px' }}>{t('publish.csvPreview')}</h3>
                  <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                    {t('publish.csvPreviewHint')}
                  </p>
                  <div className="form-grid">
                    <Field id="csvName" label="CSV filename (for entity detection)">
                      <input
                        id="csvName"
                        className="input"
                        value={csvName}
                        onChange={(e) => setCsvName(e.target.value)}
                        placeholder="e.g. trades.csv"
                      />
                    </Field>
                  </div>
                  <textarea
                    className="input csv-textarea"
                    rows={6}
                    value={csvText}
                    onChange={(e) => {
                      setCsvText(e.target.value);
                      track({ category: 'wizard', action: 'csv_preview_change', label: detectEntity(csvName) ?? 'unknown' });
                    }}
                    placeholder={'id,side,openedAt,symbol,quantity,entryPrice,pnlUsd,structural\nt1,buy,2025-08-01T09:30:00Z,USTEC,1,18000.5,120.5,win'}
                    aria-label={t('publish.csvPreview')}
                  />
                  {csvPreview ? (
                    <div className="csv-preview-result">
                      <div className="csv-preview-stats">
                        <span className="badge badge-cyan">
                          {t('publish.csvParsed')}: {csvPreview.rawRowCount}
                        </span>
                        <span className="badge badge-lime">
                          {t('publish.csvValidRows')}: {csvPreview.rows.length}
                        </span>
                        <span className="badge badge-red">
                          {t('publish.csvInvalidRows')}: {Math.max(0, csvPreview.rawRowCount - csvPreview.rows.length)}
                        </span>
                      </div>
                      {csvPreview.errors.length > 0 && (
                        <ul className="csv-errors" aria-label={t('publish.csvErrors')}>
                          {csvPreview.errors.slice(0, 20).map((e, i) => (
                            <li key={i} className="mono">
                              {e.row > 0 ? `row ${e.row}` : 'header'}
                              {e.column ? ` · ${e.column}` : ''}: {e.message}
                            </li>
                          ))}
                          {csvPreview.errors.length > 20 && (
                            <li className="muted">…and {csvPreview.errors.length - 20} more.</li>
                          )}
                        </ul>
                      )}
                      {csvPreview.rows.length > 0 && (
                        <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                          ✓ {csvPreview.rows.length} valid row(s) parsed. Calculated metrics will be compared against your declared evidence on review.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                      {t('publish.csvNoFile')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {draft.step === 3 && (
              <div className="card">
                <h2 style={{ fontSize: 20 }}>{t('publish.stepConsent')}</h2>
                <p className="muted" style={{ fontSize: 13 }}>
                  {t('publish.consentNote')}
                </p>
                <div className="consent-list">
                  {CONSENT_STATEMENTS.map((statement) => (
                    <label key={statement} className="consent-item">
                      <input
                        type="checkbox"
                        checked={draft.consent}
                        onChange={(e) => patch({ consent: e.target.checked })}
                        aria-label={t('publish.consentCheck')}
                      />
                      <span>{statement}</span>
                    </label>
                  ))}
                </div>
                {errorFor('consent') && (
                  <span className="field-error" role="alert">
                    {errorFor('consent')}
                  </span>
                )}
                <div className="private-note">
                  <strong>🔒 {t('publish.privateTitle')}</strong>
                  <p className="muted">{t('publish.privateBody')}</p>
                </div>
              </div>
            )}

            <div className="publish-actions">
              {draft.step > 0 && (
                <button className="btn" onClick={goBack}>
                  ← {t('publish.back')}
                </button>
              )}
              <Link className="btn" to="/creator">
                {t('publish.saveExit')}
              </Link>
              <button className="btn primary" onClick={goNext}>
                {draft.step === 3 ? t('publish.finish') : t('publish.continue')} →
              </button>
            </div>
          </div>
        )}

        {isDone && (
          <div className="card publish-done">
            <div className="publish-done-icon" aria-hidden="true">
              ✓
            </div>
            <h2>{t('publish.doneTitle')}</h2>
            <p className="muted" style={{ lineHeight: 1.7 }}>
              {t('publish.doneBody')}
            </p>
            <div className="actions">
              <Link className="btn primary" to="/creator">
                {t('publish.goCreator')} →
              </Link>
              <button
                className="btn"
                onClick={() => {
                  patch({ status: 'review' });
                  track({ category: 'wizard', action: 'request_review', label: draft.id });
                }}
              >
                {draft.status === 'review' ? t('publish.reviewRequested') : t('publish.requestReview')}
              </button>
              <Link className="btn" to="/publish">
                {t('publish.newDraft')}
              </Link>
            </div>
            <p className="mono" style={{ fontSize: 11, color: '#65717d', marginTop: 14 }}>
              {t('publish.neverPublished')}
            </p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
