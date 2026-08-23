/**
 * QNT-0012 · Read-only commercial server function.
 *
 * Exposes only safe commercial metadata and public feature flags. There are
 * deliberately NO write endpoints: creating users, orders, payments,
 * licenses or downloads is impossible through this surface.
 */
import { createServerFn } from '@tanstack/react-start';
import { getPublicFeatureFlags } from '../config';
import { commercialCatalog, type CommercialCatalogEntry } from './catalog';

export type CommercialCatalogPayload = {
  flags: {
    authEnabled: boolean;
    paymentsEnabled: boolean;
    downloadsEnabled: boolean;
    demoMonitoringEnabled: boolean;
  };
  products: CommercialCatalogEntry[];
};

export const getCommercialCatalog = createServerFn().handler(
  async (): Promise<CommercialCatalogPayload> => ({
    flags: getPublicFeatureFlags(),
    products: commercialCatalog,
  }),
);
