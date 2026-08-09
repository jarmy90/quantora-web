import type { QuantoraDataset } from './types';
import { validateDataset, type ValidationIssue } from './validation';

export type ImportResult = { dataset?: QuantoraDataset; errors: ValidationIssue[] };
const required = ['modelVersion', 'strategies', 'assets', 'backtests', 'equityCurves', 'tradeLogs'];

export function importJson(text: string): ImportResult {
  try {
    const parsed: unknown = JSON.parse(text);
    const errors = validateDataset(parsed);
    return errors.length ? { errors } : { dataset: parsed as QuantoraDataset, errors: [] };
  } catch (error) {
    return { errors: [{ path: '', message: `Invalid JSON: ${error instanceof Error ? error.message : 'parse error'}` }] };
  }
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) throw new Error('CSV is empty.');
  const headers = lines[0]!.split(',').map((h) => h.trim());
  if (headers.some((h) => !h)) throw new Error('CSV header contains an empty column.');
  return lines.slice(1).map((line, row) => {
    const values = line.split(',');
    if (values.length !== headers.length) throw new Error(`CSV row ${row + 2} has ${values.length} columns; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, i) => [header, values[i]!.trim()]));
  });
}

/** CSV is intentionally narrow: one file per entity, with JSON fields encoded as JSON strings. */
export function importCsv(entity: keyof QuantoraDataset, text: string): ImportResult {
  try {
    if (entity === 'modelVersion') return { errors: [{ path: 'entity', message: 'CSV entity must be an array entity.' }] };
    const rows = parseCsv(text).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
      if (['assetIds', 'backtestIds', 'tradeLogIds', 'points', 'provenance', 'metrics'].includes(key)) { try { return [key, JSON.parse(value)]; } catch { throw new Error(`Column ${key} must contain valid JSON.`); } }
      if (['quantity', 'entryPrice', 'exitPrice', 'fees', 'pnl', 'equity', 'drawdown', 'balance', 'initialCapital'].includes(key) && value !== '') return [key, Number(value)];
      return [key, value];
    })));
    const dataset = { modelVersion: '1.0', strategies: [], assets: [], backtests: [], equityCurves: [], tradeLogs: [], [entity]: rows } as unknown as QuantoraDataset;
    const errors = validateDataset(dataset);
    return errors.length ? { errors } : { dataset, errors: [] };
  } catch (error) { return { errors: [{ path: '', message: error instanceof Error ? error.message : 'CSV import failed.' }] }; }
}

export { required as requiredDatasetFields };
