import { Link } from '@tanstack/react-router';
import { t } from '../i18n';

export type EasyStartMode = 'full' | 'compact' | 'preview';

/**
 * Conceptual educational illustration for each Easy Start step.
 * These are deliberately schematic (never a faithful MetaTrader screenshot)
 * so they cannot be mistaken for a real trading interface or real data.
 * Decorative by default: the step text always carries the meaning.
 */
export function EasyVisual({ step, hide = false }: { step: 1 | 2 | 3; hide?: boolean }) {
  const label =
    step === 1
      ? t('easy.downloadTitle')
      : step === 2
        ? t('easy.installTitle')
        : t('easy.testTitle');
  const common = {
    width: '100%',
    height: 150,
    viewBox: '0 0 360 150',
    role: 'img' as const,
    'aria-label': hide ? undefined : label,
    'aria-hidden': hide ? true : undefined,
  };

  if (step === 1) {
    // DOWNLOAD: a generic package box with file rows.
    return (
      <svg {...common}>
        <rect x="16" y="20" width="148" height="112" rx="12" fill="#141b26" stroke="#2a3a4c" />
        <rect x="36" y="42" width="108" height="16" rx="4" fill="#1e2936" />
        <circle cx="58" cy="50" r="4" fill="#a3f04b" />
        <rect x="36" y="66" width="108" height="8" rx="3" fill="#22304a" />
        <rect x="48" y="80" width="96" height="8" rx="3" fill="#22304a" />
        <rect x="186" y="42" width="150" height="9" rx="4" fill="#2a3a4c" />
        <rect x="186" y="58" width="132" height="9" rx="4" fill="#22304a" />
        <rect x="186" y="74" width="120" height="9" rx="4" fill="#22304a" />
        <circle cx="196" cy="126" r="14" fill="#15301a" stroke="#a3f04b" />
        <path d="M191 126 h10 M196 121 v10" stroke="#a3f04b" strokeWidth="2" />
        <text x="224" y="130" fontSize="12" fill="#7c8998" fontFamily="DM Mono, monospace">
          .ex5
        </text>
      </svg>
    );
  }

  if (step === 2) {
    // INSTALL: folders breadcrumb + arrow into the Experts folder.
    return (
      <svg {...common}>
        {[
          [20, 84, 64],
          [92, 60, 64, 2],
          [164, 36, 64, 3],
          [236, 60, 64, 4],
        ].map(([x, y, w]: number[], i) => (
          <rect key={i} x={x as number} y={y as number} width={w as number} height="34" rx="8" fill="#141b26" stroke="#2a3a4c" />
        ))}
        <text x="34" y="106" fontSize="11" fill="#7c8998" fontFamily="DM Mono, monospace">MT5</text>
        <text x="105" y="82" fontSize="11" fill="#7c8998" fontFamily="DM Mono, monospace">MQL5</text>
        <text x="177" y="58" fontSize="11" fill="#a3f04b" fontFamily="DM Mono, monospace">Experts</text>
        <path d="M72 101 h14 v-22 h14" stroke="#3a4c60" strokeWidth="2" fill="none" />
        <path d="M188 53 h14 v13 h14" stroke="#a3f04b" strokeWidth="2" fill="none" />
        <circle cx="306" cy="77" r="13" fill="#15301a" stroke="#a3f04b" />
        <path d="M301 77 h10 M306 72 v10" stroke="#a3f04b" strokeWidth="2" />
      </svg>
    );
  }

  // TEST IN DEMO: a chart with a clearly labelled Demo account.
  return (
    <svg {...common}>
      <rect x="16" y="20" width="220" height="112" rx="12" fill="#0d131a" stroke="#2a3a4c" />
      <rect x="26" y="116" width="200" height="8" rx="3" fill="#1e2936" />
      <polyline points="40,96 70,88 96,92 122,70 150,76 176,56 210,64" fill="none" stroke="#a3f04b" strokeWidth="2" />
      <rect x="250" y="30" width="96" height="52" rx="10" fill="#15301a" stroke="#a3f04b" />
      <circle cx="266" cy="46" r="5" fill="#a3f04b" />
      <text x="278" y="50" fontSize="11" fill="#d7ffe0" fontFamily="DM Mono, monospace">
        {t('easy.demoLabel')}
      </text>
      <rect x="250" y="92" width="96" height="40" rx="8" fill="#141b26" stroke="#2a3a4c" />
      <text x="262" y="116" fontSize="11" fill="#7c8998" fontFamily="DM Mono, monospace">
        {t('easy.checklistDemo')}
      </text>
    </svg>
  );
}

/** A single conceptual package / folder / chart card used inside steps. */
export function EasyStartSteps({
  mode = 'full',
  asLinkTo = '/how-to-install',
}: {
  mode?: EasyStartMode;
  asLinkTo?: string;
}) {
  const body =
    mode === 'compact'
      ? t('easy.installBlockBody')
      : mode === 'preview'
        ? t('easy.accountBody')
        : t('easy.body');

  const steps = [
    { n: '01', title: t('easy.homeStep1'), visualTitle: t('easy.downloadTitle') },
    { n: '02', title: t('easy.homeStep2'), visualTitle: t('easy.installTitle') },
    { n: '03', title: t('easy.homeStep3'), visualTitle: t('easy.testTitle') },
  ];

  const content = (
    <>
      {mode === 'full' ? (
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.7, maxWidth: 720 }}>
          {body}
        </p>
      ) : null}
      <div
        className={mode === 'compact' ? 'easy-compact' : 'steps'}
        style={mode === 'full' || mode === 'preview' ? { marginTop: 28 } : undefined}
      >
        {mode === 'full' || mode === 'preview' ? (
          steps.map((s, i) => (
            <div className="card easy-card" key={s.n}>
              <div className="step-num mono">{s.n}</div>
              <EasyVisual step={(i + 1) as 1 | 2 | 3} />
              <h3 style={{ fontSize: 17, margin: '10px 0 4px' }}>{s.title}</h3>
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                {s.visualTitle}
              </p>
            </div>
          ))
        ) : (
          <EasyVisual step={2} />
        )}
      </div>
      {mode === 'preview' ? (
        <p className="mono" style={{ fontSize: 11, marginTop: 16, color: 'var(--amber)' }}>
          {t('easy.cta')} · {t('easy.previewNote')}
        </p>
      ) : mode === 'compact' ? (
        <Link className="btn" to={asLinkTo}>
          {t('easy.compactCta')} →
        </Link>
      ) : (
        <div style={{ marginTop: 18 }}>
          <Link className="btn primary" to="/how-to-install">
            {t('easy.cta')} →
          </Link>
        </div>
      )}
    </>
  );

  return <div className={`easy-block easy-${mode}`}>{content}</div>;
}

export default EasyStartSteps;
