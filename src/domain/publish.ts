/**
 * "Publish your strategy" wizard — typed draft model, friendly validation and
 * explicit privacy semantics.
 *
 * Honesty contract (Phase 1):
 *  - A draft lives in the browser's localStorage (explicit local fallback).
 *  - Drafts are ALWAYS private; there is no publish endpoint and nothing is
 *    ever sent to a server. "Request review" only flips a local status flag.
 *  - File drops store metadata only (name, size, type, modified time) — never
 *    the file content, which cannot be persisted in localStorage at scale.
 */
export type DraftStatus = 'draft' | 'review';

export type PublishFile = {
  id: string;
  name: string;
  size: number;
  kind: string;
  modifiedAt?: string;
};

export type PublishDraft = {
  id: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  step: number; // 0-based current step
  basics: {
    name: string;
    tagline: string;
    market: string;
    approach: string;
    description: string;
  };
  evidence: {
    profitFactor: string;
    tradeCount: string;
    netProfitUsd: string;
    maxDrawdownUsd: string;
    period: string;
  };
  files: PublishFile[];
  consent: boolean;
};

export function emptyDraft(): PublishDraft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `draft-${Date.now()}`,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    step: 0,
    basics: { name: '', tagline: '', market: '', approach: '', description: '' },
    evidence: { profitFactor: '', tradeCount: '', netProfitUsd: '', maxDrawdownUsd: '', period: '' },
    files: [],
    consent: false,
  };
}

export type FieldError = { field: string; message: string };

const notEmpty = (value: string) => value.trim().length > 0;
const isNumber = (value: string) => value.trim() !== '' && !Number.isNaN(Number(value));
const isPositive = (value: string) => Number(value) > 0;

/** Friendly, step-aware validation. Returns the errors for the current step. */
export function validateStep(draft: PublishDraft, step: number): FieldError[] {
  const errors: FieldError[] = [];
  if (step === 0) {
    if (!notEmpty(draft.basics.name)) errors.push({ field: 'name', message: 'Give your strategy a name — it helps others identify it.' });
    if (!notEmpty(draft.basics.tagline)) errors.push({ field: 'tagline', message: 'Add a short one-line description of what it does.' });
    if (!notEmpty(draft.basics.market)) errors.push({ field: 'market', message: 'Tell us which market or asset it trades.' });
    if (!notEmpty(draft.basics.approach)) errors.push({ field: 'approach', message: 'Describe the approach in a few words (e.g. trend-following).' });
  }
  if (step === 1) {
    if (!isNumber(draft.evidence.profitFactor) || !isPositive(draft.evidence.profitFactor))
      errors.push({ field: 'profitFactor', message: 'Profit factor must be a positive number (e.g. 1.25).' });
    if (!isNumber(draft.evidence.tradeCount) || !isPositive(draft.evidence.tradeCount))
      errors.push({ field: 'tradeCount', message: 'Number of operations must be a positive number.' });
    if (draft.evidence.netProfitUsd.trim() !== '' && !isNumber(draft.evidence.netProfitUsd))
      errors.push({ field: 'netProfitUsd', message: 'Net result must be a number (e.g. 6687.50).' });
  }
  if (step === 2) {
    if (draft.files.length === 0)
      errors.push({ field: 'files', message: 'Add at least one file (EA, source or documentation) to continue.' });
  }
  if (step === 3) {
    if (!draft.consent)
      errors.push({ field: 'consent', message: 'You must confirm the consent statements to continue.' });
  }
  return errors;
}

export const CONSENT_STATEMENTS = [
  'I confirm the information I provided is accurate to the best of my knowledge.',
  'I confirm I have the rights to share these files and figures.',
  'I understand Quantora will review my submission before anything is shown publicly.',
  'I understand nothing is published automatically and my draft stays private until then.',
];
