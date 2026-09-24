/**
 * QNT-0045 · Online licence validation (pure rule).
 *
 * Single source of truth for "may this MT5 account use this licence right
 * now?". Used by the public validation endpoint that the EA calls at startup
 * and once a day; the UI never decides this on its own.
 *
 * Defaults are deny. A licence is valid only when it exists, is `active`, has
 * not expired, and either has no bound account yet (first use → binds it) or is
 * already bound to the very account asking.
 *
 * Anti-sharing: the first account that validates claims the licence (up to
 * `maxActivations`, default 1). Passing the key to someone else therefore
 * fails, because their account number is not the bound one.
 * Time comes from the caller (`nowMs`) so tests are deterministic and so the
 * server clock — never the customer machine — decides the rental term.
 */
import type { LicenseStatus } from '../commercial/license';

export type LicenseRecord = {
  status: LicenseStatus;
  expiresAt: string | null;
  boundAccount: string | null;
  activations: number;
  maxActivations: number | null;
};

export type LicenseValidationInput = {
  license: LicenseRecord | null;
  /** MT5 account login asking for validation (digits as text). */
  account: string;
  nowMs?: number;
};

export type LicenseValidationReason =
  | 'ok'
  | 'ok-bound'
  | 'unknown-license'
  | 'license-not-active'
  | 'license-expired'
  | 'account-limit-reached'
  | 'bound-to-another-account'
  | 'invalid-account';

export type LicenseValidationResult = {
  valid: boolean;
  reason: LicenseValidationReason;
  /** ISO expiry the EA should honour (null = perpetual purchase). */
  expiresAt: string | null;
  /** True when validation should persist a new binding for this account. */
  bind: boolean;
};

export function accountDigits(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  return /^\d{4,12}$/.test(raw) ? raw : null;
}

export function validateLicense(input: LicenseValidationInput): LicenseValidationResult {
  const account = accountDigits(input.account);
  if (!account) {
    return { valid: false, reason: 'invalid-account', expiresAt: null, bind: false };
  }
  const license = input.license;
  if (!license) {
    return { valid: false, reason: 'unknown-license', expiresAt: null, bind: false };
  }
  if (license.status !== 'active') {
    return { valid: false, reason: 'license-not-active', expiresAt: license.expiresAt, bind: false };
  }
  if (license.expiresAt !== null) {
    const expires = Date.parse(license.expiresAt);
    if (!Number.isFinite(expires) || expires <= (input.nowMs ?? Date.now())) {
      return { valid: false, reason: 'license-expired', expiresAt: license.expiresAt, bind: false };
    }
  }
  if (license.boundAccount === null) {
    const limit = license.maxActivations;
    if (limit !== null && license.activations >= limit) {
      return { valid: false, reason: 'account-limit-reached', expiresAt: license.expiresAt, bind: false };
    }
    return { valid: true, reason: 'ok', expiresAt: license.expiresAt, bind: true };
  }
  if (license.boundAccount !== account) {
    return { valid: false, reason: 'bound-to-another-account', expiresAt: license.expiresAt, bind: false };
  }
  return { valid: true, reason: 'ok-bound', expiresAt: license.expiresAt, bind: false };
}

/** Opaque, human-typable key: QNT-XXXX-XXXX-XXXX-XXXX (16 hex, uppercase). */
export function newLicenseKey(randomHex: () => string): string {
  const hex = randomHex().replace(/[^0-9a-fA-F]/g, '').toUpperCase().padEnd(16, '0').slice(0, 16);
  return `QNT-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

/** Accepts the customer's key as typed (spaces/case tolerated). */
export function normalizeLicenseKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, '');
  if (/^[0-9A-F]{16}$/.test(cleaned)) {
    return `QNT-${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}-${cleaned.slice(12, 16)}`;
  }
  return /^QNT-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(cleaned) ? cleaned : null;
}
