/**
 * Shared UI primitives for the Phase 1 product expansion. Kept dependency-free
 * (pure props + existing CSS classes) so any route can compose them.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { POWER_SCORE_EXPLANATION, type ScoreDimension } from '../domain/product';
import { getConsent, setConsent, CONSENT_TEXT } from '../analytics/analytics';
import { t } from '../i18n';

/* ---------------------------------- Score ---------------------------------- */

/** Circular Power Score badge (1–10). */
export function PowerScore({ score, size = 'md' }: { score: number; size?: 'md' | 'lg' }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const radius = size === 'lg' ? 34 : 22;
  const circ = 2 * Math.PI * radius;
  return (
    <div className={`score score-${size}`} role="img" aria-label={`Power Score ${score} out of 10`}>
      <svg width={size === 'lg' ? 84 : 56} height={size === 'lg' ? 84 : 56} viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={radius} className="score-track" />
        <circle
          cx="42"
          cy="42"
          r={radius}
          className="score-fill"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
        />
      </svg>
      <span className={`score-value mono ${size === 'lg' ? 'score-value-lg' : ''}`}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

/** The mandatory Power Score explanation — rendered verbatim. */
export function PowerScoreExplain({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? 'power-explainer power-explainer-compact' : 'power-explainer'}>
      <strong>{t('common.powerScore')}: </strong>
      {POWER_SCORE_EXPLANATION}
    </p>
  );
}

/* --------------------------------- Badges ---------------------------------- */

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'lime' | 'cyan' | 'red' | 'amber' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: 'real' | 'mock' }) {
  return status === 'real' ? (
    <Badge tone="lime">✓ Owner-provided data</Badge>
  ) : (
    <Badge tone="amber">MOCK demo</Badge>
  );
}

/* ------------------------------ Section title ------------------------------ */

export function SectionTitle({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  return (
    <div className="section-title">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2>{title}</h2>
      {body && <p className="muted">{body}</p>}
    </div>
  );
}

/* --------------------------------- Metrics --------------------------------- */

export function MetricTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="metric-tile">
      <small>{label}</small>
      <strong style={accent ? { color: accent } : undefined}>{value}</strong>
      {sub && <span className="muted">{sub}</span>}
    </div>
  );
}

/* ------------------------------ Dimensions bar ----------------------------- */

export function DimensionBars({ dimensions }: { dimensions: ScoreDimension[] }) {
  return (
    <div className="dimensions">
      {dimensions.map((d) => (
        <div className="dimension" key={d.id}>
          <div className="dimension-head">
            <span>{d.label}</span>
            <span className="mono">
              {d.score.toFixed(1)}
              <span className="muted"> · w{d.weight.toFixed(2)}</span>
            </span>
          </div>
          <div className="dimension-track" role="img" aria-label={`${d.label}: ${d.score} of 10`}>
            <div className="dimension-fill" style={{ width: `${d.score * 10}%` }} />
          </div>
          <p className="muted">{d.why}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Empty states ------------------------------ */

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        ◌
      </div>
      <h3>{title}</h3>
      <p className="muted">{body}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

/* -------------------------------- Skeletons -------------------------------- */

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid">
      {Array.from({ length: count }, (_, i) => (
        <div className="card skeleton-card" key={i} aria-hidden="true">
          <div className="skeleton skeleton-line skeleton-wide" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line skeleton-short" />
          <div className="skeleton skeleton-chart" />
        </div>
      ))}
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

/* ------------------------------ Risk & education --------------------------- */

export function RiskNotice({ title = t('common.riskNoticeTitle'), body = t('common.riskNoticeBody') }: { title?: string; body?: string }) {
  return (
    <aside className="risk-notice">
      <strong>⚠ {title}</strong>
      <p>{body}</p>
    </aside>
  );
}

export function EducationBlock({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="edu-grid">
      {items.map((item) => (
        <div className="card edu-card" key={item.title}>
          <h3>{item.title}</h3>
          <p className="muted">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Consent banner ---------------------------- */

export function ConsentBanner() {
  const [state, setState] = useState<'undecided' | 'accepted' | 'declined'>(() => getConsent());
  const bannerRef = useRef<HTMLDivElement>(null);

  // SSR renders the undecided fallback; reconcile with persistent browser
  // consent after hydration so a prior choice remains dismissed on reload.
  useEffect(() => {
    setState(getConsent());
  }, []);

  // Reserve exactly the banner height while consent is undecided, so a fixed
  // mobile prompt never hides the last action or disclosure on a page.
  useEffect(() => {
    if (state !== 'undecided' || !bannerRef.current) return;
    const banner = bannerRef.current;
    const reserveSpace = () => {
      document.body.style.paddingBottom = `${banner.offsetHeight}px`;
    };
    reserveSpace();
    const observer = new ResizeObserver(reserveSpace);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = '';
    };
  }, [state]);

  if (state !== 'undecided') return null;
  return (
    <div ref={bannerRef} className="consent-banner" role="region" aria-label={t('analytics.consentLabel')}>
      <p>{CONSENT_TEXT}</p>
      <div className="consent-actions">
        <Link className="consent-learn" to="/legal/privacy">
          Learn more
        </Link>
        <button
          className="btn primary"
          onClick={() => {
            setConsent('accepted');
            setState('accepted');
          }}
        >
          {t('analytics.accept')}
        </button>
        <button
          className="btn"
          onClick={() => {
            setConsent('declined');
            setState('declined');
          }}
        >
          {t('analytics.decline')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ Wizard primitives -------------------------- */

export function ProgressSteps({ steps, current }: { steps: string[]; current: number }) {
  const step = current + 1;
  const progress = (step / steps.length) * 100;
  return (
    <>
      <div className="progress-mobile" aria-label={`Step ${step} of ${steps.length}: ${steps[current]}`}>
        <div>
          <span className="mono">Step {step} of {steps.length}</span>
          <strong>{steps[current]}</strong>
        </div>
        <div
          className="progress-mobile-track"
          role="progressbar"
          aria-label="Publish draft progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step}
          aria-valuetext={`Step ${step} of ${steps.length}`}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <ol className="progress">
        {steps.map((label, i) => (
          <li key={label} className={i <= current ? 'done' : ''} aria-current={i === current ? 'step' : undefined}>
            <span className="progress-dot mono">{i + 1}</span>
            <span className="progress-label">{label}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** Drag-and-drop zone — metadata only, content is never stored (Phase 1). */
export function DropZone({ onFiles }: { onFiles: (files: { name: string; size: number; kind: string; modifiedAt?: string }[]) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files).map((f) => ({
          name: f.name,
          size: f.size,
          kind: f.type || 'file',
          modifiedAt: f.lastModified ? new Date(f.lastModified).toISOString() : undefined,
        }));
        onFiles(files);
      }}
    >
      <div className="dropzone-icon" aria-hidden="true">
        ⇪
      </div>
      <p>{t('publish.dropTitle')}</p>
      <p className="muted">{t('publish.dropHint')}</p>
    </div>
  );
}

/* ------------------------------ Seo helper ------------------------------- */

/** Client-side meta manager for dynamic pages (title + description + OG). */
export function Seo({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    document.title = title;
    const upsert = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    upsert('name', 'description', description);
    upsert('property', 'og:title', title);
    upsert('property', 'og:description', description);
    upsert('property', 'og:type', 'website');
    upsert('property', 'og:site_name', 'Quantora');
  }, [title, description]);
  return null;
}

/* ------------------------------- Misc helpers ------------------------------ */

export function CompareChip({ ids, onView }: { ids: string[]; onView?: () => void }) {
  if (ids.length === 0) return null;
  return (
    <div className="compare-chip">
      <span className="mono">
        {ids.length} {ids.length === 1 ? t('compare.item') : t('compare.items')}
      </span>
      <Link className="btn primary btn-sm" to="/compare" onClick={onView}>
        {t('compare.view')} →
      </Link>
    </div>
  );
}

export function BackLink({ to = '/strategies', label = 'Back to strategies' }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="btn btn-sm detail-back-link">
      ← {label}
    </Link>
  );
}
