/**
 * QNT-0015 · Access-mode selector + pre-checkout summary (visual preview only).
 *
 * The selector modifies local visual state only. It never submits, never calls
 * Supabase, never creates an order and never assigns amounts. Monthly rental is
 * the highlighted (future initial) mode; quarterly, annual and purchase are
 * marked as coming soon. The tagline below always states that prices and
 * availability will be announced before checkout is enabled.
 */
import type { ProductOfferViewModel, AccessMode } from '../domain/commercial/productOffer';
import { t } from '../i18n';

const MODE_KEYS = [
  { mode: 'monthly' as const, labelKey: 'modes.monthly' as const, descKey: 'modes.monthlyDesc' as const },
  { mode: 'quarterly' as const, labelKey: 'modes.quarterly' as const, descKey: 'modes.quarterlyDesc' as const },
  { mode: 'annual' as const, labelKey: 'modes.annual' as const, descKey: 'modes.annualDesc' as const },
  { mode: 'purchase' as const, labelKey: 'modes.purchase' as const, descKey: 'modes.purchaseDesc' as const },
];

export function AccessModeSelector({
  offer,
  value,
  onChange,
}: {
  offer: ProductOfferViewModel;
  value: AccessMode;
  onChange: (mode: AccessMode) => void;
}) {
  return (
    <div>
      <fieldset className="mode-selector" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="tag" style={{ marginBottom: 10 }}>{t('offer.chooseMode')}</legend>
        {MODE_KEYS.map(({ mode, labelKey, descKey }) => {
          const option = offer.supportedAccessModes.find((m) => m.mode === mode)!;
          const isSelected = value === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${t(labelKey)}${option.state === 'coming_soon' ? ` (${t('modes.comingSoon')})` : ''}`}
              className={`mode-option ${isSelected ? 'selected' : ''} ${option.state === 'coming_soon' ? 'mode-soon' : ''}`}
              onClick={() => onChange(mode)}
            >
              <span className="mode-label">{t(labelKey)}</span>
              {option.state === 'coming_soon' && (
                <span className="status-chip coming-soon mode-chip">{t('modes.comingSoon')}</span>
              )}
              <span className="mode-desc">{t(descKey)}</span>
              <span className="mode-price">{t('offer.availableSoon')}</span>
            </button>
          );
        })}
      </fieldset>
      <p className="muted offer-note" style={{ marginTop: 10 }}>
        {t('offer.priceAnnouncement')}
      </p>
    </div>
  );
}

export function ProductSummaryCard({ offer, selected }: { offer: ProductOfferViewModel; selected: AccessMode }) {
  const modeLabel = MODE_KEYS.find((m) => m.mode === selected)!.labelKey;
  return (
    <div className="product-summary" role="status" aria-live="polite">
      <div className="eyebrow" style={{ marginBottom: 10 }}>{t('offer.summaryEyebrow')}</div>
      <dl className="summary-list">
        <div><dt>{t('offer.summaryStrategy')}</dt><dd>{offer.displayName}</dd></div>
        <div><dt>{t('offer.summaryMode')}</dt><dd>{t(modeLabel)}</dd></div>
        <div><dt>{t('offer.summaryStatus')}</dt><dd>{offer.availabilityLabel}</dd></div>
        <div><dt>{t('offer.summaryCompatibility')}</dt><dd>MetaTrader 5</dd></div>
        <div><dt>{t('offer.summaryNext')}</dt><dd>{t('offer.summaryNextText')}</dd></div>
      </dl>
    </div>
  );
}
