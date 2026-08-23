/**
 * QNT-0013 · Pure auth input validation.
 *
 * No Supabase calls here — these run on the client for instant feedback and
 * again on the server before any SDK call. Errors are generic on purpose so
 * they never reveal whether an email exists.
 */
export type ValidationResult = { ok: true } | { ok: false; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): ValidationResult {
  const value = email.trim().toLowerCase();
  if (value.length === 0) return { ok: false, message: 'Enter your email address.' };
  if (!EMAIL_RE.test(value)) return { ok: false, message: 'That email address does not look right.' };
  return { ok: true };
}

/**
 * Reasonable baseline without inventing enterprise policy: at least 8
 * characters and not trivially weak. Supabase enforces its own minimum too.
 */
export function validatePassword(password: string): ValidationResult {
  if (password.length === 0) return { ok: false, message: 'Choose a password.' };
  if (password.length < 8) return { ok: false, message: 'Use at least 8 characters.' };
  if (/^\s+$/.test(password)) return { ok: false, message: 'Password cannot be only spaces.' };
  return { ok: true };
}

export function validateDisplayName(displayName: string): ValidationResult {
  const value = displayName.trim();
  if (value.length === 0) return { ok: true };
  if (value.length > 80) return { ok: false, message: 'Keep your name under 80 characters.' };
  return { ok: true };
}
