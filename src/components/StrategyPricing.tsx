/**
 * QNT-0041 · Public price display.
 *
 * Renders the plans carried by the generated catalog. It never invents a
 * price: without a displayable plan the component renders nothing at all, and
 * the amount is presentation-only — checkout resolves every amount
 * server-side and the client never sends a price back.
 *
 * `variant="inline"` is the discreet catalog-card line; `variant="block"` is
 * the detail-page block (price, what is included, launch note).
 */
import type { PublicStrategy } from '../domain/publicStrategy';
import type { PublicPlan } from '../domain/publicStrategy';
import {
  formatPlanPrice,
  planIntervalLabelKey,
  summarizePublicPlans,
  type PricingLocale,
} from '../domain/commercial/publicPlans';
import { t } from '../i18n';
import { getActiveLocale, toTag } from '../i18n/locale';

function currentPricingLocale(): PricingLocale {
  return toTag(getActiveLocale()) === 'es' ? 'es' : 'en';
}

/** "300 €" + "pago único" for the active locale. */
export function priceLabel(plan: PublicPlan): string {
  return `${formatPlanPrice(plan, currentPricingLocale())} ${t(planIntervalLabelKey(plan))}`;
}

export function StrategyPricing({
  plans,
  variant = 'inline',
}: {
  plans: PublicStrategy['plans'];
  variant?: 'inline' | 'block';
}) {
  const { purchase, rental, hasAny } = summarizePublicPlans(plans);
  if (!hasAny) return null;

  if (variant === 'inline') {
    const parts = [purchase, rental].filter((plan): plan is PublicPlan => plan !== null).map(priceLabel);
    return (
      <p className="price-line" style={{ margin: '10px 0 0', fontSize: 13, color: '#c8f26b' }}>
        {parts.join(' · ')}
      </p>
    );
  }

  return (
    <section className="card" style={{ marginTop: 15 }} aria-label={t('pricing.title')}>
      <div className="eyebrow">{t('pricing.title')}</div>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', margin: '10px 0 6px' }}>
        {purchase && (
          <div>
            <div style={{ fontSize: 24, letterSpacing: '-.02em' }}>{formatPlanPrice(purchase, currentPricingLocale())}</div>
            <small className="muted">{t('pricing.interval.one_time')}</small>
          </div>
        )}
        {rental && (
          <div>
            <div style={{ fontSize: 24, letterSpacing: '-.02em' }}>{formatPlanPrice(rental, currentPricingLocale())}</div>
            <small className="muted">{t('pricing.interval.monthly')}</small>
          </div>
        )}
      </div>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: '0 0 8px' }}>
        {t('pricing.included')}
      </p>
      <p className="cost-note" style={{ margin: 0 }}>
        {t('pricing.launchNote')}
      </p>
    </section>
  );
}
