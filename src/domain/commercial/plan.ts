/**
 * QNT-0012 · Plan contract.
 *
 * A plan is the commercial modality (rental or purchase) attached to a
 * product. Initial plans must stay `draft` with null prices: null is never
 * treated as zero, and nothing is ever shown as "Free" or "€0".
 */

export type BillingModel = 'rental' | 'purchase';

export type BillingInterval = 'monthly' | 'quarterly' | 'annual' | 'one_time';

export type PlanStatus = 'draft' | 'inactive' | 'active' | 'retired';

export const BILLING_MODELS: readonly BillingModel[] = ['rental', 'purchase'] as const;
export const BILLING_INTERVALS: readonly BillingInterval[] = [
  'monthly',
  'quarterly',
  'annual',
  'one_time',
] as const;
export const PLAN_STATUSES: readonly PlanStatus[] = [
  'draft',
  'inactive',
  'active',
  'retired',
] as const;

export type Plan = {
  planId: string;
  productId: string;
  billingModel: BillingModel;
  billingInterval: BillingInterval;
  status: PlanStatus;
  /** Minor units (e.g. cents). Null while draft — never treated as zero. */
  priceAmountMinor: number | null;
  /** ISO 4217 code. Null while draft — no currency is active. */
  currency: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isPlanStatus(value: unknown): value is PlanStatus {
  return typeof value === 'string' && (PLAN_STATUSES as readonly string[]).includes(value);
}

/**
 * A billing model/interval combination is valid only when it is coherent:
 * rental plans recur on a calendar interval (monthly, quarterly, annual),
 * purchase plans are a one-time transaction (one_time).
 */
export function isBillingCombinationValid(
  plan: Pick<Plan, 'billingModel' | 'billingInterval'>,
): boolean {
  if (plan.billingModel === 'rental') {
    return (
      plan.billingInterval === 'monthly' ||
      plan.billingInterval === 'quarterly' ||
      plan.billingInterval === 'annual'
    );
  }
  if (plan.billingModel === 'purchase') {
    return plan.billingInterval === 'one_time';
  }
  return false;
}

/** True only when a plan is selectable: active AND carries a real price. */
export function hasUsablePrice(plan: Pick<Plan, 'priceAmountMinor' | 'currency'>): boolean {
  return (
    plan.priceAmountMinor !== null &&
    plan.currency !== null &&
    plan.priceAmountMinor > 0 &&
    plan.currency.trim().length > 0
  );
}
