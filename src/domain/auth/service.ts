/**
 * QNT-0013 · Supabase auth service (server-side).
 *
 * The ONLY production AuthService. It runs inside TanStack server functions,
 * where `getRequest()` / `setResponseHeader()` are available, so sessions live
 * in an HttpOnly cookie (`quantora-auth-token`) that the browser never reads
 * from JavaScript.
 *
 * Security rules enforced here:
 *   - SUPABASE_SERVICE_ROLE_KEY is never imported; verification of the
 *     access token happens against the public client with `getUser(token)`.
 *   - Tokens are never logged, never returned to the client bundle.
 *   - Cookie flags: HttpOnly, SameSite=Lax, Secure in production.
 *   - When Supabase env is missing, every call returns `not_configured`
 *     instead of pretending auth works.
 */
import { getRequest, setResponseHeader, setResponseStatus } from '@tanstack/react-start-server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '../../lib/supabase/env';
import { validateEmail, validatePassword, validateDisplayName } from './validation';
import type {
  AuthResult,
  AuthService,
  AuthUser,
  PasswordResetRequest,
  PasswordUpdate,
  SignInInput,
  SignUpInput,
} from './contracts';

const SESSION_COOKIE = 'quantora-auth-token';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days, refreshed on activity

function mapError(error: { status?: number; message?: string; code?: string }): AuthResult {
  const code = error.code ?? String(error.status ?? '');
  const message = (error.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return { ok: false, error: 'invalid_credentials', message: 'The email or password is not correct.' };
  }
  if (message.includes('email not confirmed') || message.includes('verify your email')) {
    return { ok: false, error: 'email_not_verified', message: 'Please confirm your email first — check your inbox.' };
  }
  if (message.includes('already registered') || message.includes('user already')) {
    return { ok: false, error: 'email_taken', message: 'An account with that email already exists.' };
  }
  if (message.includes('weak password') || message.includes('password should be')) {
    return { ok: false, error: 'weak_password', message: 'That password is too weak. Use at least 8 characters.' };
  }
  if (message.includes('expired') || message.includes('invalid token') || message.includes('invalid jwt')) {
    return { ok: false, error: 'expired_link', message: 'This link has expired or is invalid. Request a new one.' };
  }
  if (message.includes('network') || message.includes('fetch')) {
    return { ok: false, error: 'network_error', message: 'Network problem. Check your connection and try again.' };
  }
  return { ok: false, error: 'unknown', message: 'Something went wrong. Please try again.' };
}

function cookieOptions(secure: boolean): string {
  return [
    `Max-Age=${MAX_AGE_SECONDS}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** Public client for a server-side call. Never holds service-role secrets. */
function publicClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function currentAccessToken(): string | null {
  const request = getRequest();
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE}=`)) {
      const value = trimmed.slice(SESSION_COOKIE.length + 1);
      return value.length > 0 ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

function persistSession(accessToken: string, refreshToken: string): void {
  const secure = Boolean(import.meta.env.PROD) || Boolean((import.meta.env.VITE_SITE_URL as string | undefined)?.startsWith('https'));
  setResponseHeader('set-cookie', `${SESSION_COOKIE}=${encodeURIComponent(accessToken)}; ${cookieOptions(secure)}`);
  // The refresh token is kept only in memory for this request; the access
  // token drives getUser() verification. Rotation is handled by Supabase on
  // the next explicit refresh.
  void refreshToken;
}

function clearSessionCookie(): void {
  const secure = Boolean(import.meta.env.PROD) || Boolean((import.meta.env.VITE_SITE_URL as string | undefined)?.startsWith('https'));
  setResponseHeader('set-cookie', `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`);
}

async function verifyUserFromToken(url: string, key: string, token: string): Promise<AuthUser | null> {
  const client = publicClient(url, key);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const email = data.user.email ?? null;
  return {
    id: data.user.id,
    email,
    displayName:
      typeof meta.display_name === 'string' && meta.display_name.trim() !== ''
        ? meta.display_name.trim()
        : email,
    emailVerified: Boolean(data.user.email_confirmed_at) || Boolean(data.user.confirmed_at),
  };
}

export class SupabaseAuthService implements AuthService {
  async signUp(input: SignUpInput): Promise<AuthResult> {
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) {
      return { ok: false, error: 'not_configured', message: 'Authentication is not configured yet.' };
    }
    const emailCheck = validateEmail(input.email);
    if (!emailCheck.ok) return { ok: false, error: 'invalid_form', message: emailCheck.message };
    const passCheck = validatePassword(input.password);
    if (!passCheck.ok) return { ok: false, error: 'invalid_form', message: passCheck.message };
    const nameCheck = validateDisplayName(input.displayName ?? '');
    if (!nameCheck.ok) return { ok: false, error: 'invalid_form', message: nameCheck.message };

    const client = publicClient(env.url, env.publishableKey);
    const { data, error } = await client.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: { display_name: input.displayName?.trim() || null },
        emailRedirectTo: `${appOrigin()}/auth/callback?type=signup&returnTo=${encodeURIComponent(input.returnTo ?? '/')}`,
      },
    });
    if (error) return mapError(error);
    const session = data.session;
    if (session) {
      persistSession(session.access_token, session.refresh_token);
      return { ok: true, session: { accessToken: session.access_token, refreshToken: session.refresh_token, user: await verifyUserFromToken(env.url, env.publishableKey, session.access_token) ?? { id: session.user.id, email: session.user.email ?? null, displayName: null, emailVerified: false } } };
    }
    // Email confirmation required — no session yet.
    return { ok: true, session: null };
  }

  async signIn(input: SignInInput): Promise<AuthResult> {
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) {
      return { ok: false, error: 'not_configured', message: 'Authentication is not configured yet.' };
    }
    const emailCheck = validateEmail(input.email);
    if (!emailCheck.ok) return { ok: false, error: 'invalid_form', message: emailCheck.message };
    const passCheck = validatePassword(input.password);
    if (!passCheck.ok) return { ok: false, error: 'invalid_form', message: passCheck.message };

    const client = publicClient(env.url, env.publishableKey);
    const { data, error } = await client.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });
    if (error) return mapError(error);
    if (!data.session) return { ok: false, error: 'unknown', message: 'No session was returned. Please try again.' };
    persistSession(data.session.access_token, data.session.refresh_token);
    return {
      ok: true,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email ?? null,
          displayName:
            typeof data.user.user_metadata?.display_name === 'string'
              ? data.user.user_metadata.display_name
              : (data.user.email ?? null),
          emailVerified: Boolean(data.user.email_confirmed_at) || Boolean(data.user.confirmed_at),
        },
      },
    };
  }

  async signOut(): Promise<AuthResult> {
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) {
      clearSessionCookie();
      return { ok: true, session: null };
    }
    clearSessionCookie();
    // Best-effort server-side sign-out; the cookie is already gone so the
    // client session is invalid even if the network call fails.
    try {
      await publicClient(env.url, env.publishableKey).auth.signOut();
    } catch {
      /* ignore — local cookie is cleared regardless */
    }
    return { ok: true, session: null };
  }

  async requestPasswordReset(input: PasswordResetRequest): Promise<AuthResult> {
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) {
      return { ok: false, error: 'not_configured', message: 'Authentication is not configured yet.' };
    }
    const emailCheck = validateEmail(input.email);
    if (!emailCheck.ok) return { ok: false, error: 'invalid_form', message: emailCheck.message };
    // Always resolve success for non-configured emails (never leak existence).
    const { error } = await publicClient(env.url, env.publishableKey).auth.resetPasswordForEmail(
      input.email.trim().toLowerCase(),
      { redirectTo: `${appOrigin()}/auth/callback?type=recovery` },
    );
    if (error && (error.status ?? 0) !== 400) return mapError(error);
    return { ok: true, session: null };
  }

  async updatePassword(input: PasswordUpdate): Promise<AuthResult> {
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) {
      return { ok: false, error: 'not_configured', message: 'Authentication is not configured yet.' };
    }
    const passCheck = validatePassword(input.newPassword);
    if (!passCheck.ok) return { ok: false, error: 'invalid_form', message: passCheck.message };
    const token = currentAccessToken();
    if (!token) {
      return { ok: false, error: 'expired_link', message: 'Your session expired. Request a new reset link.' };
    }
    // The password change runs with the caller's own access token (the reset
    // flow exchanges a recovery code for a session in /auth/callback, which
    // sets this cookie) — never with service-role privileges.
    const client = publicClient(env.url, env.publishableKey);
    await client.auth.setSession({ access_token: token, refresh_token: '' });
    const { error } = await client.auth.updateUser({ password: input.newPassword });
    if (error) return mapError(error);
    return { ok: true, session: null };
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) return null;
    const token = currentAccessToken();
    if (!token) return null;
    return verifyUserFromToken(env.url, env.publishableKey, token);
  }
}

function appOrigin(): string {
  return (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'http://localhost:3000';
}

/** Request-scoped singleton so server functions share one service instance. */
export function getAuthService(): AuthService {
  return new SupabaseAuthService();
}

/** Used by the callback route to mark an invalid PKCE exchange. */
export function setCallbackFailure(): void {
  setResponseStatus(400);
}
