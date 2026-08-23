/**
 * QNT-0013 · Auth domain contracts.
 *
 * The rest of the application depends on these types and on `AuthService`,
 * never directly on the Supabase SDK. A single server-side implementation
 * (`SupabaseAuthService`) plus an in-memory TEST-ONLY fake live in
 * `./service.ts` / `./fake.ts`; the UI only ever sees the public shapes
 * below. Sessions are managed with HttpOnly cookies by the server layer —
 * nothing sensitive is stored in localStorage.
 */
export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type AuthResult =
  | { ok: true; session: AuthSession | null }
  | { ok: false; error: AuthErrorCode; message: string };

export type AuthErrorCode =
  | 'invalid_form'
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'email_taken'
  | 'weak_password'
  | 'expired_link'
  | 'network_error'
  | 'not_configured'
  | 'invalid_callback'
  | 'unknown';

export type SignUpInput = {
  email: string;
  password: string;
  displayName?: string;
  /** Internal path to return to after sign-in (never external). */
  returnTo?: string;
};

export type SignInInput = {
  email: string;
  password: string;
  returnTo?: string;
};

export type PasswordResetRequest = {
  email: string;
};

export type PasswordUpdate = {
  newPassword: string;
};

/**
 * Auth operations. All methods are server-side: they read the request cookie,
 * talk to Supabase, and persist the session cookie on success. The UI never
 * holds tokens.
 */
export interface AuthService {
  signUp(input: SignUpInput): Promise<AuthResult>;
  signIn(input: SignInInput): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
  requestPasswordReset(input: PasswordResetRequest): Promise<AuthResult>;
  updatePassword(input: PasswordUpdate): Promise<AuthResult>;
  /** Verified current user from the request cookie, or null. */
  getCurrentUser(): Promise<AuthUser | null>;
}

/** Internal-safe redirect target (same-origin path only). */
export function isSafeReturnTo(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === '' || value === '/') return true;
  if (!value.startsWith('/')) return false;
  // Reject protocol-relative and backslash tricks.
  if (value.startsWith('//') || value.startsWith('/\\')) return false;
  // Reject anything that looks like an external origin sneaking in.
  if (/^https?:/i.test(value)) return false;
  try {
    const url = new URL(value, 'http://internal.local');
    return url.origin === 'http://internal.local';
  } catch {
    return false;
  }
}

/** Keep a returnTo from leaking sensitive or external destinations. */
export function sanitizeReturnTo(value: unknown): string | null {
  if (!isSafeReturnTo(value)) return null;
  const clean = value.split('#')[0].split('?')[0];
  return clean === '' ? '/' : clean;
}
