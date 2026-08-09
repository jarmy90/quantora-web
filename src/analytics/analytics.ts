/**
 * Analytics layer — consent-first, anonymous, no sensitive data.
 *
 * Phase 1 rule: nothing is tracked unless the visitor explicitly opts in via
 * the consent banner. Even then, events are strictly anonymous and minimal
 * (page/strategy ids and a category), never account data, never financial
 * figures, never free-text. Swap the `track` implementation for a real
 * analytics SDK later — the event shape stays the same.
 */
import { readLocal, writeLocal } from '../state/storage';

export type ConsentState = 'undecided' | 'accepted' | 'declined';

const CONSENT_KEY = 'quantora.analytics.consent';

export function getConsent(): ConsentState {
  return readLocal<ConsentState>(CONSENT_KEY, 'undecided');
}

export function setConsent(state: 'accepted' | 'declined'): void {
  writeLocal(CONSENT_KEY, state);
}

export type AnalyticsEvent = {
  category: 'navigation' | 'strategy' | 'wizard' | 'engagement';
  action: string;
  /** Optional anonymous entity id (e.g. strategy id). Never personal data. */
  label?: string;
};

/**
 * Consent-gated, anonymous event sink. Phase 1 default: log to the console
 * when opted in — there is no external collector, and this is documented.
 */
export function track(event: AnalyticsEvent): void {
  if (getConsent() !== 'accepted') return;
  // Deliberately anonymous: no user id, no financial values, no free text.
  // eslint-disable-next-line no-console
  console.info('[quantora:analytics]', event.category, event.action, event.label ?? '');
}

export const CONSENT_TEXT =
  'We would like to count anonymous page and strategy views to improve the product. No personal data, no financial figures, no tracking across sites. You can change this anytime in your browser.';
