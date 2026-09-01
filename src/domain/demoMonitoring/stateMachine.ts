/**
 * QNT-0015 · Demo monitoring state machine and freshness rules.
 *
 * Pure, deterministic functions. The UI never decides a trust state on its
 * own: real snapshots are resolved server-side from these rules.
 */
import type { DemoFreshness, DemoMonitoringStatus } from './contracts';

/** Default freshness window for demo data (15 minutes). */
export const DEMO_STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * Explicit transition table. Every allowed transition is listed here;
 * anything not listed is invalid by construction.
 *
 * - not_connected: no monitored connection is configured.
 * - connecting: a connection attempt is in progress (no feed claimed yet).
 * - live_demo: recent demo data is available.
 * - stale: demo data exists but is older than the freshness window.
 * - offline: the configured connection is not operational.
 */
export const DEMO_MONITORING_TRANSITIONS: Record<
  DemoMonitoringStatus,
  readonly DemoMonitoringStatus[]
> = {
  not_connected: ['connecting'],
  connecting: ['live_demo', 'stale', 'offline', 'not_connected'],
  live_demo: ['connecting', 'stale', 'offline', 'not_connected'],
  stale: ['live_demo', 'connecting', 'offline', 'not_connected'],
  offline: ['connecting', 'not_connected'],
};

export function canTransition(
  from: DemoMonitoringStatus,
  to: DemoMonitoringStatus,
): boolean {
  return (DEMO_MONITORING_TRANSITIONS[from] as readonly DemoMonitoringStatus[]).includes(to);
}

/** Documented meaning of each state (used by docs and tests, not UI copy). */
export function describeDemoMonitoringStatus(status: DemoMonitoringStatus): string {
  switch (status) {
    case 'not_connected':
      return 'no monitored connection is configured';
    case 'connecting':
      return 'a connection attempt is in progress; no feed is claimed yet';
    case 'live_demo':
      return 'recent demo data is available';
    case 'stale':
      return 'demo data exists but is older than the freshness window';
    case 'offline':
      return 'the configured connection is not operational';
  }
}

/**
 * Deterministic freshness from the last demo update timestamp.
 * - undefined timestamp -> 'unknown' (no demo data ever supplied)
 * - timestamp inside window -> 'live'
 * - timestamp outside window -> 'stale'
 */
export function deriveDemoFreshness(
  lastUpdatedAt: string | undefined,
  now: number = Date.now(),
  staleAfterMs: number = DEMO_STALE_AFTER_MS,
): DemoFreshness {
  if (lastUpdatedAt === undefined) return 'unknown';
  const updatedAt = Date.parse(lastUpdatedAt);
  // Invalid timestamps never convert into a live state.
  if (Number.isNaN(updatedAt)) return 'unknown';
  // Future timestamps are invalid data: never treated as fresh without control.
  if (updatedAt > now) return 'unknown';
  if (now - updatedAt <= staleAfterMs) return 'live';
  return 'stale';
}

/** Inputs the server uses to resolve a connection state (never the UI). */
export type ConnectionInput = {
  /** Whether a demo connection is configured for this strategy. */
  hasConfiguredConnection: boolean;
  /** Whether a connection attempt is currently in progress. */
  isAttemptingConnection: boolean;
  /** Whether the configured connection is operational. */
  isOperational: boolean;
  /** ISO timestamp of the last supplied demo update, if any. */
  lastUpdatedAt?: string;
  /** Clock for freshness resolution (defaults to Date.now()). */
  now?: number;
};

/**
 * Deterministic resolver — the client receives the OUTPUT and never computes
 * a connection state on its own.
 *
 * 1. No configured connection                -> not_connected
 * 2. Configured but not operational          -> offline
 * 3. Attempting with no data yet             -> connecting
 * 4. Configured, operational, with data      -> live_demo or stale (freshness)
 */
export function resolveConnectionStatus(input: ConnectionInput): DemoMonitoringStatus {
  if (!input.hasConfiguredConnection) return 'not_connected';
  if (!input.isOperational) return 'offline';
  if (input.isAttemptingConnection && input.lastUpdatedAt === undefined) return 'connecting';
  if (input.lastUpdatedAt !== undefined) {
    return deriveDemoFreshness(input.lastUpdatedAt, input.now) === 'stale' ? 'stale' : 'live_demo';
  }
  return 'connecting';
}