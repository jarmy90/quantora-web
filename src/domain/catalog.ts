import type { Strategy } from './types';
import { validateDataset } from './validation';
import type { QuantoraDataset } from './types';

/** Selective overlay: imported real records replace only matching IDs; all other catalog entries remain mock. */
export function mergeCatalog(mock: Strategy[], imported: QuantoraDataset): Strategy[] {
  const issues = validateDataset(imported);
  if (issues.length) throw new Error(`Cannot merge invalid dataset: ${issues[0]?.path} ${issues[0]?.message}`);
  const incoming = new Map(imported.strategies.map((strategy) => [strategy.id, strategy]));
  return mock.map((strategy) => incoming.get(strategy.id) ?? strategy).concat(
    imported.strategies.filter((strategy) => !mock.some((item) => item.id === strategy.id)),
  );
}
