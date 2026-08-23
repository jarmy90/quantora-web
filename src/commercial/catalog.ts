/**
 * QNT-0012 · Safe commercial catalog.
 *
 * Derived from the four public strategies (never duplicated in components).
 * Exposes only commercially safe fields: productId, strategyId, displayName,
 * productStatus, deliveryFormat, commercialDownloadEnabled and derived
 * availability. No sources, paths, vault references, filenames, hashes,
 * sourceArchive or credentials ever cross this boundary. Metrics are not
 * duplicated here — strategy data stays in the public strategy catalog.
 */
import { publicStrategies } from '../catalog';
import { getProductAvailability } from '../domain/commercial/rules';
import type { ProductStatus } from '../domain/commercial/product';

export type CommercialCatalogEntry = {
  productId: string;
  strategyId: string;
  displayName: string;
  productStatus: ProductStatus;
  deliveryFormat: 'ex5';
  commercialDownloadEnabled: boolean;
  availability: {
    canStartCheckout: boolean;
    canDownload: boolean;
    canNotify: boolean;
  };
};

export function buildCommercialCatalog(): CommercialCatalogEntry[] {
  return publicStrategies
    .filter((strategy) => Boolean(strategy.productId && strategy.productStatus))
    .map((strategy) => {
      const status = strategy.productStatus as ProductStatus;
      const availability = getProductAvailability(
        {
          status,
          commercialDownloadEnabled: strategy.commercialDownloadEnabled === true,
        },
        [],
      );
      return {
        productId: strategy.productId as string,
        strategyId: strategy.id,
        displayName: strategy.name,
        productStatus: status,
        deliveryFormat: 'ex5' as const,
        commercialDownloadEnabled: strategy.commercialDownloadEnabled === true,
        availability: {
          canStartCheckout: availability.canStartCheckout,
          canDownload: availability.canDownload,
          canNotify: availability.canNotify,
        },
      };
    })
    .sort((a, b) => a.productId.localeCompare(b.productId));
}

/** Snapshot evaluated once at module load from the versioned public catalog. */
export const commercialCatalog: CommercialCatalogEntry[] = buildCommercialCatalog();
