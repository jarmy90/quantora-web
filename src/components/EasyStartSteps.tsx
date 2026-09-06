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

  if (step === 1) {
    // DOWNLOAD: a generic package box with file rows.
    return (
      <svg
        width="100%"
        height={150}
        viewBox="0 0 360 150"
        role="img"
        aria-label={hide ? undefined : label}
        aria-hidden={hide ? true : undefined}
      >
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
    // INSTALL: clear 4-node horizontal pipeline:
    // [.ex5 file] --> [Open MetaTrader 5] --> [File > Open Data Folder] --> [MQL5/Experts ★]
    return (
      <svg
        width="100%"
        height={150}
        viewBox="0 0 760 150"
        role="img"
        aria-label={hide ? undefined : label}
        aria-hidden={hide ? true : undefined}
        style={{ display: 'block' }}
      >
        {/* ── Node 1: .ex5 File ── */}
        <g transform="translate(10, 37)">
          <rect width="154" height="76" rx="10" fill="#0f1720" stroke="#2a3a4c" strokeWidth="1.5" />
          {/* file icon */}
          <rect x="12" y="12" width="24" height="28" rx="4" fill="#1a2717" stroke="#a3f04b" strokeWidth="1.2" />
          <path d="M26 25 l6 0 M26 31 l6 0" stroke="#a3f04b" strokeWidth="1.5" strokeLinecap="round" />
          <text x="46" y="28" fontSize="13" fontWeight="700" fill="#a3f04b" fontFamily="DM Mono, monospace">.ex5</text>
          <text x="12" y="57" fontSize="11" fill="#5a7080" fontFamily="Manrope, sans-serif">Compiled EA file</text>
        </g>

        {/* ── Arrow 1 → 2 ── */}
        <line x1="164" y1="75" x2="192" y2="75" stroke="#3d5468" strokeWidth="2" strokeDasharray="5 3" />
        <polygon points="190,70 200,75 190,80" fill="#3d5468" />

        {/* ── Node 2: MetaTrader 5 ── */}
        <g transform="translate(200, 37)">
          <rect width="160" height="76" rx="10" fill="#0f1720" stroke="#2a3a4c" strokeWidth="1.5" />
          {/* MT5 icon placeholder */}
          <rect x="12" y="12" width="26" height="26" rx="6" fill="#152130" stroke="#4a9eff" strokeWidth="1.2" />
          <text x="14" y="30" fontSize="11" fontWeight="800" fill="#4a9eff" fontFamily="DM Mono, monospace">MT5</text>
          <text x="48" y="28" fontSize="12" fontWeight="700" fill="#d4e4f4" fontFamily="Manrope, sans-serif">MetaTrader 5</text>
          <text x="12" y="57" fontSize="11" fill="#5a7080" fontFamily="Manrope, sans-serif">Open the platform</text>
        </g>

        {/* ── Arrow 2 → 3 ── */}
        <line x1="360" y1="75" x2="388" y2="75" stroke="#3d5468" strokeWidth="2" strokeDasharray="5 3" />
        <polygon points="386,70 396,75 386,80" fill="#3d5468" />

        {/* ── Node 3: File > Open Data Folder ── */}
        <g transform="translate(396, 37)">
          <rect width="178" height="76" rx="10" fill="#0f1720" stroke="#2a3a4c" strokeWidth="1.5" />
          {/* folder icon */}
          <rect x="12" y="14" width="22" height="16" rx="3" fill="#1a2717" stroke="#72d9ff" strokeWidth="1.2" />
          <rect x="10" y="20" width="26" height="16" rx="3" fill="#152130" stroke="#72d9ff" strokeWidth="1.2" />
          <text x="44" y="28" fontSize="11" fontWeight="700" fill="#72d9ff" fontFamily="DM Mono, monospace">File › Open Data</text>
          <text x="12" y="50" fontSize="11" fill="#5a7080" fontFamily="Manrope, sans-serif">Navigate to MQL5</text>
          <text x="12" y="63" fontSize="11" fill="#5a7080" fontFamily="Manrope, sans-serif">folder on your PC</text>
        </g>

        {/* ── Arrow 3 → 4 (lime = destination reached) ── */}
        <line x1="574" y1="75" x2="598" y2="75" stroke="#a3f04b" strokeWidth="2.5" />
        <polygon points="596,70 608,75 596,80" fill="#a3f04b" />

        {/* ── Node 4: MQL5/Experts (destination) ── */}
        <g transform="translate(608, 27)">
          <rect width="144" height="96" rx="12" fill="#0b1a08" stroke="#a3f04b" strokeWidth="2" />
          {/* destination badge */}
          <rect x="0" y="0" width="144" height="22" rx="12" fill="#1a3012" />
          <rect x="0" y="11" width="144" height="11" fill="#1a3012" />
          <text x="72" y="15" textAnchor="middle" fontSize="9" fontWeight="800" fill="#a3f04b" letterSpacing="1.5" fontFamily="DM Mono, monospace">DESTINATION</text>
          <text x="14" y="48" fontSize="14" fontWeight="800" fill="#ffffff" fontFamily="DM Mono, monospace">MQL5/</text>
          <text x="14" y="64" fontSize="14" fontWeight="800" fill="#a3f04b" fontFamily="DM Mono, monospace">Experts</text>
          <text x="14" y="82" fontSize="11" fill="#6aaa30" fontFamily="Manrope, sans-serif">Paste .ex5 here ✓</text>
        </g>
      </svg>
    );
  }

  // TEST IN DEMO: a chart with a clearly labelled Demo account.
  return (
    <svg
      width="100%"
      height={150}
      viewBox="0 0 360 150"
      role="img"
      aria-label={hide ? undefined : label}
      aria-hidden={hide ? true : undefined}
    >
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