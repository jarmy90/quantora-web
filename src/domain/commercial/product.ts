/**
 * QNT-0012 · Product contract.
 *
 * A product is the commercial EA associated with a *public strategy*. Product
 * identity (productId) is deliberately distinct from strategy identity
 * (strategyId). Only commercially safe fields live here: no vault paths, no
 * MQ5/SET filenames, no private hashes, no source archives.
 */

export type ProductStatus =
  | 'not_listed'
  | 'coming_soon'
  | 'available'
  | 'paused'
  | 'deprecated';

/** Only delivery format admitted initially. */
export type DeliveryFormat = 'ex5';

export const PRODUCT_STATUSES: readonly ProductStatus[] = [
  'not_listed',
  'coming_soon',
  'available',
  'paused',
  'deprecated',
] as const;

export const DELIVERY_FORMATS: readonly DeliveryFormat[] = ['ex5'] as const;

export type Product = {
  productId: string;
  strategyId: string;
  displayName: string;
  status: ProductStatus;
  deliveryFormat: DeliveryFormat;
  /** False while demo-only. Must dominate every CTA regardless of status. */
  commercialDownloadEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === 'string' && (PRODUCT_STATUSES as readonly string[]).includes(value);
}
