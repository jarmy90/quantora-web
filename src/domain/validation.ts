import type { QuantoraDataset } from './types';

export type ValidationIssue = { path: string; message: string };
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const idList = (value: unknown) => Array.isArray(value) && value.every(text);

/** Conservative structural validation; business values absent from an import remain absent. */
export function validateDataset(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input || typeof input !== 'object') return [{ path: '', message: 'Dataset must be a JSON object.' }];
  const data = input as Partial<QuantoraDataset>;
  if (data.modelVersion !== '1.0') issues.push({ path: 'modelVersion', message: 'Expected modelVersion "1.0".' });
  for (const key of ['strategies', 'assets', 'backtests', 'equityCurves', 'tradeLogs'] as const) {
    if (!Array.isArray(data[key])) issues.push({ path: key, message: 'Expected an array.' });
  }
  const ids = new Set<string>();
  for (const [kind, records] of Object.entries(data)) {
    if (!Array.isArray(records)) continue;
    records.forEach((record, index) => {
      if (!record || typeof record !== 'object') return issues.push({ path: `${kind}[${index}]`, message: 'Expected an object.' });
      const item = record as Record<string, unknown>;
      if (!text(item.id)) issues.push({ path: `${kind}[${index}].id`, message: 'Required non-empty id.' });
      else if (ids.has(item.id as string)) issues.push({ path: `${kind}[${index}].id`, message: 'IDs must be globally unique.' });
      else ids.add(item.id as string);
      if (!item.provenance || typeof item.provenance !== 'object') issues.push({ path: `${kind}[${index}].provenance`, message: 'Required provenance object.' });
      else {
        const provenance = item.provenance as Record<string, unknown>;
        if (provenance.dataStatus !== 'mock' && provenance.dataStatus !== 'real') issues.push({ path: `${kind}[${index}].provenance.dataStatus`, message: 'Must be "mock" or "real".' });
        if (!text(provenance.sourceName)) issues.push({ path: `${kind}[${index}].provenance.sourceName`, message: 'Required non-empty sourceName.' });
      }
    });
  }
  data.strategies?.forEach((s, i) => { if (!idList(s.assetIds)) issues.push({ path: `strategies[${i}].assetIds`, message: 'Must be a non-empty or empty string ID list.' }); });
  data.backtests?.forEach((b, i) => { if (!idList(b.assetIds) || !idList(b.tradeLogIds)) issues.push({ path: `backtests[${i}]`, message: 'assetIds and tradeLogIds must be string ID lists.' }); });
  return issues;
}
