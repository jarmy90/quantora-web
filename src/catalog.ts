/**
 * Public strategy catalog (generated, versioned dataset).
 *
 * `public-strategies/catalog.json` is produced by the intake pipeline
 * (`bun run strategies:intake`). It contains only client-facing fields —
 * internal states (`dataStatus`, `validationStatus`, `status`) and evidence
 * hashes never cross this boundary. Metrics and the Quantora Score are computed
 * from authorized source files, not hand-written in components.
 */
import raw from '../public-strategies/catalog.json';
import type { PublicCatalog, PublicStrategy } from './domain/publicStrategy';

export const publicCatalog = raw as unknown as PublicCatalog;
export const publicStrategies: PublicStrategy[] = publicCatalog.strategies ?? [];

export function findPublicStrategy(id: string): PublicStrategy | undefined {
  return publicStrategies.find((strategy) => strategy.id === id);
}
