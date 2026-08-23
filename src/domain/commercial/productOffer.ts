/**
 * QNT-0015 · Product offer presentation model.
 *
 * A presentation view-model derived from safe public strategy/product data and
 * deliberately kept separate from the *economic* persistence model
 * (plans/orders/payments/licences). It never carries amount, currency, tax,
 * discount, checkout session, payment provider, licence key, download URL,
 * vault path, source filename, MQ5/EX5/SET or private hashes.
 *
 * The four mapped products remain coming_soon; nothing here enables a real
 * checkout, order, payment, licence or download. Callers resolve the CTA from
 * the derived availability — never from these fields as a security boundary.
 */
import type { PublicStrategy } from '../publicStrategy';
import type { ProductStatus } from './product';

export type AccessMode = 'monthly' | 'quarterly' | 'annual' | 'purchase';
export type AccessModeState = 'highlighted' | 'coming_soon';
export type CtaState = 'signIn' | 'seeOptions' | 'unavailable';

export type AccessModeOption = { mode: AccessMode; state: AccessModeState };

export type ProductOfferViewModel = {
  productId: string;
  strategyId: string;
  displayName: string;
  market: string | null;
  timeframe: string | null;
  status: ProductStatus;
  supportedAccessModes: AccessModeOption[];
  highlightedAccessMode: AccessMode;
  /** Derived availability label, e.g. "Available soon". */
  availabilityLabel: string;
  productBenefits: string[];
  requirements: string[];
  limitations: string[];
  canStartCheckout: boolean;
  canDownload: boolean;
  /** Left empty here — resolved by resolveProductCta (needs auth context). */
  ctaState: CtaState;
  ctaLabel: string;
};

export const ACCESS_MODES: readonly AccessMode[] = [
  'monthly',
  'quarterly',
  'annual',
  'purchase',
] as const;

export function isAccessMode(value: unknown): value is AccessMode {
  return typeof value === 'string' && (ACCESS_MODES as readonly string[]).includes(value);
}

/**
 * Access status for the visual pilot: monthly rental is the highlighted
 * (future initial) mode; quarterly, annual and purchase are marked as coming
 * soon. No amounts are assigned to any mode.
 */
const PILOT_ACCESS_STATES: Record<AccessMode, AccessModeState> = {
  monthly: 'highlighted',
  quarterly: 'coming_soon',
  annual: 'coming_soon',
  purchase: 'coming_soon',
};

const BENEFITS: readonly string[] = [
  'Access to the compiled Expert Advisor when the product is enabled',
  'Recommended settings file, when available',
  'Guided installation for MetaTrader 5',
  'Licence managed from your Quantora account',
  'Updates for the version you have access to',
];

const REQUIREMENTS: readonly string[] = [
  'MetaTrader 5',
  'A demo or live account you control',
  'Algorithmic trading enabled on the platform',
];

const LIMITATIONS: readonly string[] = [
  'No product, price, licence or download is active yet',
  'Backtest results are historical evidence, not a guarantee of future performance',
];

function availabilityLabelFor(status: ProductStatus): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'paused':
      return 'Temporarily unavailable';
    case 'deprecated':
      return 'No longer offered';
    case 'not_listed':
      return 'Unavailable';
    case 'coming_soon':
    default:
      return 'Available soon';
  }
}

/**
 * Build the safe presentation view-model for a strategy's product. Returns
 * undefined when the strategy has no public product identity/status (it is
 * not commercially listed). Never throws and never exposes private fields.
 */
export function buildProductOffer(strategy: PublicStrategy): ProductOfferViewModel | undefined {
  if (!strategy.productId || !strategy.productStatus) return undefined;

  const status = strategy.productStatus;
  const offer: ProductOfferViewModel = {
    productId: strategy.productId,
    strategyId: strategy.id,
    displayName: strategy.name,
    market: strategy.market ?? null,
    timeframe: strategy.period?.timeframe ?? strategy.assets[0] ?? null,
    status,
    supportedAccessModes: ACCESS_MODES.map((mode) => ({
      mode,
      state: PILOT_ACCESS_STATES[mode],
    })),
    highlightedAccessMode: 'monthly',
    availabilityLabel: availabilityLabelFor(status),
    productBenefits: [...BENEFITS],
    requirements: [...REQUIREMENTS],
    limitations: [...LIMITATIONS],
    canStartCheckout: false,
    canDownload: false,
    ctaState: status === 'coming_soon' ? 'seeOptions' : 'unavailable',
    ctaLabel: 'See options',
  };
  return offer;
}

export type ResolvedProductCta = {
  ctaState: CtaState;
  ctaLabel: string;
  /** Internal product route (also the safe post-login return target). */
  productPath: string;
  /** Internal safe returnTo for the anonymous sign-in flow. */
  returnTo: string;
};

/**
 * Resolve the conversion CTA from derived availability plus auth context.
 * Anonymous users sign in and return to the product preview; authenticated
 * users open the product page directly. Statuses other than coming_soon never
 * offer a conversion action in this phase.
 */
export function resolveProductCta(
  offer: Pick<ProductOfferViewModel, 'status' | 'productId' | 'strategyId'>,
  { isAuthenticated }: { isAuthenticated: boolean },
): ResolvedProductCta {
  const productPath = `/products/${offer.productId}`;
  if (offer.status !== 'coming_soon') {
    return { ctaState: 'unavailable', ctaLabel: 'Coming soon', productPath, returnTo: productPath };
  }
  if (isAuthenticated) {
    return { ctaState: 'seeOptions', ctaLabel: 'See options', productPath, returnTo: productPath };
  }
  return { ctaState: 'signIn', ctaLabel: 'Sign in to continue', productPath, returnTo: productPath };
}
