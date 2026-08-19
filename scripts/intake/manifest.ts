/**
 * QNT-0003 strategy intake manifest contract.
 *
 * A manifest is the single, data-driven authoring document for one strategy.
 * Its `dataset` field reuses the Phase 2A domain contracts (`QuantoraDataset`,
 * `Strategy`, `Provenance`, `ValidationStatus`, `Metrics`) verbatim, so a new
 * strategy can be added without touching TypeScript, routes or components.
 *
 * `validateManifest` is pure and returns `ManifestIssue[]` where `level` is
 * either `error` (blocking) or `warning` (optional-field notice). It never
 * throws and never mutates its input.
 */
import type { QuantoraDataset } from '../../src/domain/types.ts';
import { validateDataset, type ValidationIssue } from '../../src/domain/validation.ts';

export const MANIFEST_VERSION = '1.0' as const;

export type EvidenceClassification = 'public' | 'private';

export type ManifestEvidence = {
  /** Path relative to the manifest's own directory. */
  file: string;
  /** Coarse category: rules | report | source | trades | equity | other. */
  kind: string;
  /** Whether this file may ever appear in the public bundle. */
  classification: EvidenceClassification;
  note?: string;
};

export type Manifest = {
  manifestVersion: typeof MANIFEST_VERSION;
  strategyId: string;
  tagline?: string;
  type?: string;
  rules?: string[];
  limitations?: string[];
  costs?: Record<string, string>;
  variant?: string;
  configuration?: string;
  evidence?: ManifestEvidence[];
  dataset: QuantoraDataset;
};

export type ManifestIssue = {
  level: 'error' | 'warning';
  path: string;
  message: string;
};

/**
 * Extensions that must never surface in the public bundle, regardless of how
 * the manifest classifies them. Keeping them public is a blocking error.
 */
export const FORBIDDEN_PUBLIC_EXTENSIONS: string[] = [
  '.mq4',
  '.mq5',
  '.ex4',
  '.ex5',
  '.set',
  '.env',
  '.pem',
  '.key',
  '.crt',
  '.p12',
  '.pfx',
];

const FORBIDDEN_PATH_FRAGMENTS = ['credential', 'secret', 'token', 'password', 'private'];

/** Returns a human reason when a public evidence file is forbidden, else null. */
export function forbiddenPublicReason(file: string): string | null {
  const lower = file.toLowerCase();
  const lastDot = lower.lastIndexOf('.');
  if (lastDot >= 0) {
    const ext = lower.slice(lastDot);
    if (FORBIDDEN_PUBLIC_EXTENSIONS.includes(ext)) {
      return `extension "${ext}" is forbidden in public output`;
    }
  }
  const base = lower.split(/[\\/]/).pop() ?? lower;
  if (base === '.env' || base.startsWith('.env.')) {
    return 'environment/credential files are forbidden in public output';
  }
  if (FORBIDDEN_PATH_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
    return 'path suggests credentials or private content';
  }
  return null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isText);

const isStringMap = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every(isText);

function error(path: string, message: string): ManifestIssue {
  return { level: 'error', path, message };
}

function warning(path: string, message: string): ManifestIssue {
  return { level: 'warning', path, message };
}

export function validateManifest(value: unknown): ManifestIssue[] {
  const issues: ManifestIssue[] = [];

  if (!isRecord(value)) {
    return [error('', 'Manifest must be a JSON object.')];
  }

  if (value.manifestVersion !== MANIFEST_VERSION) {
    issues.push(error('manifestVersion', `Expected manifestVersion "${MANIFEST_VERSION}".`));
  }
  if (!isText(value.strategyId)) {
    issues.push(error('strategyId', 'Required non-empty strategyId.'));
  }

  if (value.tagline !== undefined && !isText(value.tagline)) {
    issues.push(error('tagline', 'Must be a non-empty string.'));
  }
  if (value.type !== undefined && !isText(value.type)) {
    issues.push(error('type', 'Must be a non-empty string.'));
  }
  if (value.rules !== undefined && !isStringArray(value.rules)) {
    issues.push(error('rules', 'Must be an array of non-empty strings.'));
  }
  if (value.limitations !== undefined && !isStringArray(value.limitations)) {
    issues.push(error('limitations', 'Must be an array of non-empty strings.'));
  }
  if (value.costs !== undefined && !isStringMap(value.costs)) {
    issues.push(error('costs', 'Must be an object of non-empty string values.'));
  }
  if (value.variant !== undefined && !isText(value.variant)) {
    issues.push(error('variant', 'Must be a non-empty string.'));
  }
  if (value.configuration !== undefined && !isText(value.configuration)) {
    issues.push(error('configuration', 'Must be a non-empty string.'));
  }

  if (value.evidence !== undefined) {
    if (!Array.isArray(value.evidence)) {
      issues.push(error('evidence', 'Must be an array.'));
    } else {
      value.evidence.forEach((entry, index) => {
        const path = `evidence[${index}]`;
        if (!isRecord(entry)) {
          issues.push(error(path, 'Expected an object.'));
          return;
        }
        if (!isText(entry.file)) issues.push(error(`${path}.file`, 'Required non-empty file path.'));
        if (!isText(entry.kind)) issues.push(error(`${path}.kind`, 'Required non-empty kind.'));
        if (entry.classification !== 'public' && entry.classification !== 'private') {
          issues.push(error(`${path}.classification`, 'Must be "public" or "private".'));
        }
        if (entry.note !== undefined && !isText(entry.note)) {
          issues.push(error(`${path}.note`, 'Must be a non-empty string.'));
        }
        if (isText(entry.file) && entry.classification === 'public') {
          const reason = forbiddenPublicReason(entry.file);
          if (reason) issues.push(error(`${path}.classification`, `Public evidence is forbidden: ${reason}.`));
        }
      });
    }
  }

  if (!isRecord(value.dataset)) {
    issues.push(error('dataset', 'Required dataset object (QuantoraDataset).'));
  } else {
    const datasetIssues: ValidationIssue[] = validateDataset(value.dataset);
    for (const issue of datasetIssues) {
      issues.push(error(`dataset.${issue.path}`, issue.message));
    }

    const strategies = value.dataset.strategies;
    if (Array.isArray(strategies)) {
      if (strategies.length !== 1) {
        issues.push(error('dataset.strategies', 'A manifest must contain exactly one strategy.'));
      } else if (isText(value.strategyId) && isRecord(strategies[0]) && strategies[0].id !== value.strategyId) {
        issues.push(error('strategyId', 'strategyId must match dataset.strategies[0].id.'));
      }
    }
  }

  // Optional-field notices (never blocking).
  if (value.tagline === undefined) {
    issues.push(warning('tagline', 'tagline is optional but recommended for the catalog.'));
  }
  if (value.evidence === undefined || (Array.isArray(value.evidence) && value.evidence.length === 0)) {
    issues.push(warning('evidence', 'No evidence files declared (optional).'));
  }
  if (
    isRecord(value.dataset) &&
    Array.isArray(value.dataset.backtests) &&
    value.dataset.backtests.length === 0
  ) {
    issues.push(warning('dataset.backtests', 'Documentary-only strategy: no backtest results, metrics, equity or trades.'));
  }

  return issues;
}
