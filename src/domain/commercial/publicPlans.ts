/**
 * QNT-0041 · Public pricing presentation helpers.
 *
 * Pure, non-throwing helpers that turn the plans embedded in the generated
 * catalog into presentation data. They never invent a price: a plan without a
 * usable positive amount and a currency is ignored, and an empty summary means
 * "show no price at all" (never 0, never "free").
 */
import type { PublicPlan } from '../publicStrategy';

export type PublicPricingSummary = {
  /** Purchase (one-time) plan with a usable price, or null. */
  purchase: PublicPlan | null;
  /** Rental (recurring) plan with a usable price, or null. */
  rental: PublicPlan | null;
  /** True when at least one price can be shown. */
  hasAny: boolean;
};

/** A price is displayable only when it is a positive integer with a currency. */
export function isDisplayablePlan(plan: PublicPlan): boolean {
  return (
    Number.isInteger(plan.priceAmountMinor) &&
    plan.priceAmountMinor > 0 &&
    typeof plan.currency === 'string' &&
    plan.currency.trim().length === 3
  );
}

/** Splits public plans into purchase/rental; ignores anything not displayable. */
export function summarizePublicPlans(plans: PublicPlan[] | undefined): PublicPricingSummary {
  const list = (plans ?? []).filter(isDisplayablePlan);
  const pick = (model: PublicPlan['billingModel']): PublicPlan | null =>
    list.find((plan) => plan.billingModel === model) ?? null;
  const purchase = pick('purchase');
  const rental = pick('rental');
  return { purchase, rental, hasAny: purchase !== null || rental !== null };
}

export type PricingLocale = 'es' | 'en';

const LOCALE_TAG: Record<PricingLocale, string> = { es: 'es-ES', en: 'en-US' };

/** "300 €" / "€300" — integer minor units rendered in the active locale. */
export function formatPlanPrice(
  plan: Pick<PublicPlan, 'priceAmountMinor' | 'currency'>,
  locale: PricingLocale = 'es',
): string {
  const amount = plan.priceAmountMinor / 100;
  return new Intl.NumberFormat(LOCALE_TAG[locale] ?? LOCALE_TAG.es, {
    style: 'currency',
    currency: plan.currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** i18n keys for the billing interval wording (literal union → type-safe `t()`). */
export type PlanIntervalLabelKey =
  | 'pricing.interval.one_time'
  | 'pricing.interval.monthly'
  | 'pricing.interval.quarterly'
  | 'pricing.interval.annual';

export function planIntervalLabelKey(
  plan: Pick<PublicPlan, 'billingInterval'>,
): PlanIntervalLabelKey {
  switch (plan.billingInterval) {
    case 'monthly':
      return 'pricing.interval.monthly';
    case 'quarterly':
      return 'pricing.interval.quarterly';
    case 'annual':
      return 'pricing.interval.annual';
    default:
      return 'pricing.interval.one_time';
  }
}
