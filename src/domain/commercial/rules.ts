/**
 * QNT-0012 · Commercial state rules.
 *
 * Pure, non-throwing functions that prevent incompatible states. They never
 * mutate anything and never throw; they return a boolean (or a structured
 * availability object) plus a reason so failures are never silent.
 */
import type { Entitlement } from './entitlement';
import type { License } from './license';
import type { Order } from './order';
import { hasUsablePrice, isBillingCombinationValid, type Plan } from './plan';
import type { Product, ProductStatus } from './product';

export type PurchaseEligibility = {
  canStartCheckout: boolean;
  canDownload: boolean;
  canNotify: boolean;
  reason: string;
};

const reason = (message: string) => message;

/** Statuses that can never be purchased. */
const UNPURCHASABLE: readonly ProductStatus[] = [
  'not_listed',
  'coming_soon',
  'paused',
  'deprecated',
] as const;

/** A product may be purchased only when it is available. */
export function canPurchaseProduct(product: Pick<Product, 'status'>): boolean {
  return product.status === 'available';
}

export function purchaseBlockedReason(
  product: Pick<Product, 'status'>,
): string | null {
  if ((UNPURCHASABLE as readonly string[]).includes(product.status)) {
    return `product status "${product.status}" is not purchasable`;
  }
  return null;
}

/**
 * Only an active plan with a real price AND a coherent billing model/interval
 * combination can be selected.
 */
export function canSelectPlan(
  plan: Pick<Plan, 'status' | 'billingModel' | 'billingInterval' | 'priceAmountMinor' | 'currency'>,
): boolean {
  return plan.status === 'active' && isBillingCombinationValid(plan) && hasUsablePrice(plan);
}

export function planBlockedReason(
  plan: Pick<Plan, 'status' | 'billingModel' | 'billingInterval' | 'priceAmountMinor' | 'currency'>,
): string | null {
  if (plan.status !== 'active') return `plan status "${plan.status}" is not selectable`;
  if (!isBillingCombinationValid(plan)) {
    return `billing combination "${plan.billingModel} + ${plan.billingInterval}" is invalid`;
  }
  if (!hasUsablePrice(plan)) return 'plan has no usable price';
  return null;
}

/**
 * Checkout may start only when the product is purchasable AND a selectable
 * plan exists. With the current data (all products coming_soon, no active
 * plans) this is always false.
 */
export function canStartCheckout(
  product: Pick<Product, 'status'>,
  plans: Pick<Plan, 'status' | 'billingModel' | 'billingInterval' | 'priceAmountMinor' | 'currency'>[],
): boolean {
  return canPurchaseProduct(product) && plans.some(canSelectPlan);
}

/** `paid` can never be set from client input — a hard rule, not a hint. */
export function canMarkOrderPaidFromClient(): boolean {
  return false;
}

export function markPaidBlockedReason(): string {
  return 'paid can only be set by a server-side payment-confirmation path';
}

/** A payment may be marked succeeded only when it references an order. */
export function canMarkPaymentSucceeded(payment: { orderId: string | null }): boolean {
  return payment.orderId !== null && payment.orderId.length > 0;
}

/** A license may become active only when its order is paid. */
export function canActivateLicense(license: { status: string }, order: Pick<Order, 'status'>): boolean {
  return license.status === 'pending' && order.status === 'paid';
}

export function licenseActivationBlockedReason(
  license: { status: string },
  order: Pick<Order, 'status'>,
): string | null {
  if (license.status !== 'pending') return `license status "${license.status}" cannot be activated`;
  if (order.status !== 'paid') return `order status "${order.status}" is not paid`;
  return null;
}

/**
 * A download entitlement may be granted only when every condition holds:
 * product available, download enabled, license active, entitlement granted.
 */
export function canGrantDownload(input: {
  product: Pick<Product, 'status' | 'commercialDownloadEnabled'>;
  license: Pick<License, 'status'>;
  entitlement: Pick<Entitlement, 'status' | 'canDownload'>;
}): boolean {
  return (
    input.product.status === 'available' &&
    input.product.commercialDownloadEnabled === true &&
    input.license.status === 'active' &&
    input.entitlement.status === 'granted' &&
    input.entitlement.canDownload === true
  );
}

export function downloadBlockedReason(input: {
  product: Pick<Product, 'status' | 'commercialDownloadEnabled'>;
  license: Pick<License, 'status'>;
  entitlement: Pick<Entitlement, 'status' | 'canDownload'>;
}): string | null {
  if (input.product.status !== 'available') return `product status "${input.product.status}" is not available`;
  if (input.product.commercialDownloadEnabled !== true) return 'commercial download is not enabled';
  if (input.license.status !== 'active') return `license status "${input.license.status}" is not active`;
  if (input.entitlement.status !== 'granted') return `entitlement status "${input.entitlement.status}" is not granted`;
  if (input.entitlement.canDownload !== true) return 'entitlement does not allow download';
  return null;
}

/**
 * Public availability of a product, derived from safe product data only.
 * Never used as a security boundary — final checks happen server-side.
 */
export function getProductAvailability(
  product: Pick<Product, 'status' | 'commercialDownloadEnabled'>,
  plans: Pick<Plan, 'status' | 'billingModel' | 'billingInterval' | 'priceAmountMinor' | 'currency'>[],
): PurchaseEligibility {
  const checkout = canStartCheckout(product, plans);
  const download = canGrantDownload({
    product,
    license: { status: 'pending' },
    entitlement: { status: 'pending', canDownload: false },
  });
  return {
    canStartCheckout: checkout,
    canDownload: download,
    canNotify: product.status === 'coming_soon',
    reason: download
      ? 'download available'
      : reason(
          [
            purchaseBlockedReason(product),
            planBlockedReasonIfAny(plans),
            'commercial download not enabled',
          ]
            .filter(Boolean)
            .join('; '),
        ),
  };
}

function planBlockedReasonIfAny(
  plans: Pick<Plan, 'status' | 'billingModel' | 'billingInterval' | 'priceAmountMinor' | 'currency'>[],
): string | null {
  if (plans.length === 0) return 'no plan exists';
  if (!plans.some(canSelectPlan)) return 'no selectable plan';
  return null;
}
