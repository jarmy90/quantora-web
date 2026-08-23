/**
 * QNT-0012 · Server-only environment configuration.
 *
 * Distinguishes development / test / staging / production, exposes only
 * PUBLIC feature flags (never secrets) and is import-safe in both server and
 * client bundles (the client guard falls back to defaults, so accidental
 * client imports cannot crash or leak). Commercial capabilities default to
 * false and can only be enabled server-side via environment variables —
 * never via public VITE_ variables.
 *
 * ⚠️ Keep this module free of secrets: getPublicFeatureFlags() must never
 * return raw environment values.
 */
export type AppEnv = 'development' | 'test' | 'staging' | 'production';

export type FeatureFlags = {
  authEnabled: boolean;
  paymentsEnabled: boolean;
  downloadsEnabled: boolean;
  demoMonitoringEnabled: boolean;
};

export type EnvironmentSnapshot = {
  appEnv: AppEnv;
  flags: FeatureFlags;
  hasDatabaseUrl: boolean;
};

/** Import-safe env access: returns {} when bundled for the client. */
function env(): Record<string, string | undefined> {
  return typeof process === 'undefined' ? {} : process.env;
}

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  return false;
}

export function resolveAppEnv(e: Record<string, string | undefined> = env()): AppEnv {
  const raw = (e.APP_ENV ?? '').trim().toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'staging') return 'staging';
  if (raw === 'test') return 'test';
  return 'development';
}

/** All commercial flags default to false. Never exposed to the client as secrets. */
export function getFeatureFlags(e: Record<string, string | undefined> = env()): FeatureFlags {
  return {
    authEnabled: parseBool(e.AUTH_ENABLED),
    paymentsEnabled: parseBool(e.PAYMENTS_ENABLED),
    downloadsEnabled: parseBool(e.DOWNLOADS_ENABLED),
    demoMonitoringEnabled: parseBool(e.DEMO_MONITORING_ENABLED),
  };
}

/** Public flags only — safe to return from a server function. */
export function getPublicFeatureFlags(): FeatureFlags {
  return getFeatureFlags();
}

/** Server-side snapshot; contains no secrets, so it is safe to log. */
export function getEnvironmentSnapshot(
  e: Record<string, string | undefined> = env(),
): EnvironmentSnapshot {
  return {
    appEnv: resolveAppEnv(e),
    flags: getFeatureFlags(e),
    hasDatabaseUrl: Boolean(e.DATABASE_URL && e.DATABASE_URL.length > 0),
  };
}

/** One-line human description (booleans and a set/not-set flag only). */
export function describeEnvironment(e: Record<string, string | undefined> = env()): string {
  const snapshot = getEnvironmentSnapshot(e);
  const parts = [`app_env=${snapshot.appEnv}`];
  for (const [key, value] of Object.entries(snapshot.flags)) {
    parts.push(`${key}=${value}`);
  }
  parts.push(`database_url=${snapshot.hasDatabaseUrl ? 'set' : 'not set'}`);
  return parts.join(' · ');
}
