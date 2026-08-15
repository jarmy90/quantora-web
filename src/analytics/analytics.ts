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
 * V2B analytics actions — strictly anonymous, no sensitive data. These are the
 * new interaction events added by the performance-analytics UX. The `track`
 * sink never logs financial figures or free text, only the category/action and
 * an anonymous label (strategy id or a non-sensitive key).
 */
export const ANALYTICS_ACTIONS = {
  changeEquityRange: 'change_equity_range',
  toggleEquityUnit: 'toggle_equity_unit',
  inspectTradeTooltip: 'inspect_trade_tooltip',
  openPerformanceTab: 'open_performance_tab',
  filterTradeLog: 'filter_trade_log',
  paginateTradeLog: 'paginate_trade_log',
  openMonthlyHeatmapCell: 'open_monthly_heatmap_cell',
  expandStructuralEconomic: 'expand_structural_economic',
} as const;

/**
 * Consent-gated, anonymous event sink. V2B: zero console output by design
 * (the product must ship with no console noise). Events are accepted only when
 * the visitor has opted in; with no external collector wired up yet the sink
 * is intentionally a no-op. Swap in a real analytics SDK later — the event
 * shape and consent gate stay the same.
 */
export function track(event: AnalyticsEvent): void {
  if (getConsent() !== 'accepted') return;
  // Deliberately anonymous and silent: no user id, no financial values, no
  // free text, and no console output. A future collector can subscribe here.
  void event;
}

export const CONSENT_TEXT =
  'We would like to count anonymous page and strategy views to improve the product. No personal data, no financial figures, no tracking across sites. You can change this anytime in your browser.';
