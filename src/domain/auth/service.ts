/**
 * QNT-0013C · Supabase auth service (server-side).
 *
 * The ONLY production AuthService. Sessions use the official `@supabase/ssr`
 * `createServerClient` wired to the TanStack request/response context through
 * `createSsrCookieAdapter()`: BOTH the access token and the refresh token are
 * persisted in HttpOnly cookies, so Supabase can rotate/renew the session
 * (the refresh token is never discarded). The public results returned to the
 * UI contain zero tokens.
 *
 * Security rules enforced here:
 *   - SUPABASE_SERVICE_ROLE_KEY is never imported; user verification runs
 *     with the public client (`getUser`), never with service-role privileges.
 *   - Tokens are never logged, never returned to the client bundle, never
 *     written to localStorage.
 *   - Cookie flags: HttpOnly, SameSite=Lax, Secure in production, Path=/.
 *   - Sign-out clears every session cookie.
 *   - When Supabase env is missing, every call returns `not_configured`.
 */
import { setResponseStatus } from '@tanstack/react-start-server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '../../lib/supabase/env';
import { createSsrCookieAdapter, clearAllSessionCookies } from './ssr-cookies';
import { validateEmail, validatePassword, validateDisplayName } from './validation';
import type {
  AuthService,
  AuthUser,
  PasswordResetRequest,
  PasswordUpdate,
  PublicAuthResult,
  SignInInput,
  SignUpInput,
} from './contracts';

function mapError(error: { status?: number; message?: string; code?: string }): PublicAuthResult {
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

/** Server-side Supabase client with the SSR cookie adapter (no tokens in code). */
function serverClient(url: string, key: string): SupabaseClient {
  const adapter = createSsrCookieAdapter();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => adapter.getAll(),
      setAll: (cookies) => adapter.setAll(cookies),
    },
  });
}

function toAuthUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown>; email_confirmed_at?: string | null; confirmed_at?: string | null }): AuthUser {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = user.email ?? null;
  return {
    id: user.id,
    email,
    displayName:
      typeof meta.display_name === 'string' && meta.display_name.trim() !== ''
        ? meta.display_name.trim()
        : email,
    emailVerified: Boolean(user.email_confirmed_at) || Boolean(user.confirmed_at),
  };
}

export class SupabaseAuthService implements AuthService {
  async signUp(input: SignUpInput): Promise<PublicAuthResult> {
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

    const client = serverClient(env.url, env.publishableKey);
    const { data, error } = await client.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: { display_name: input.displayName?.trim() || null },
        emailRedirectTo: `${appOrigin()}/auth/callback?type=signup&returnTo=${encodeURIComponent(input.returnTo ?? '/')}`,
      },
    });
    if (error) return mapError(error);
    if (data.session) {
      // SignUp returned a session directly (rare; usually email confirmation
      // is required). The createServerClient adapter already persisted it.
      return { ok: true, user: data.user ? toAuthUser(data.user) : null, requiresEmailVerification: false };
    }
    // Email confirmation required — no session yet.
    return { ok: true, user: null, requiresEmailVerification: true };
  }

  async signIn(input: SignInInput): Promise<PublicAuthResult> {
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) {
      return { ok: false, error: 'not_configured', message: 'Authentication is not configured yet.' };
    }
    const emailCheck = validateEmail(input.email);
    if (!emailCheck.ok) return { ok: false, error: 'invalid_form', message: emailCheck.message };
    const passCheck = validatePassword(input.password);
    if (!passCheck.ok) return { ok: false, error: 'invalid_form', message: passCheck.message };

    const client = serverClient(env.url, env.publishableKey);
    const { data, error } = await client.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });
    if (error) return mapError(error);
    if (!data.session) return { ok: false, error: 'unknown', message: 'No session was returned. Please try again.' };
    return { ok: true, user: data.user ? toAuthUser(data.user) : null, requiresEmailVerification: false };
  }

  async signOut(): Promise<PublicAuthResult> {
    const env = getSupabaseEnv();
    clearAllSessionCookies();
    if (env.state === 'configured' && env.url && env.publishableKey) {
      try {
        await serverClient(env.url, env.publishableKey).auth.signOut();
      } catch {
        /* ignore — local cookies are already cleared */
      }
    }
    return { ok: true, user: null, requiresEmailVerification: false };
  }

  async requestPasswordReset(input: PasswordResetRequest): Promise<PublicAuthResult> {
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) {
      return { ok: false, error: 'not_configured', message: 'Authentication is not configured yet.' };
    }
    const emailCheck = validateEmail(input.email);
    if (!emailCheck.ok) return { ok: false, error: 'invalid_form', message: emailCheck.message };
    // Always resolve success (never leak whether the account exists).
    const { error } = await serverClient(env.url, env.publishableKey).auth.resetPasswordForEmail(
      input.email.trim().toLowerCase(),
      { redirectTo: `${appOrigin()}/auth/callback?type=recovery` },
    );
    if (error && (error.status ?? 0) !== 400) return mapError(error);
    return { ok: true, user: null, requiresEmailVerification: false };
  }

  async updatePassword(input: PasswordUpdate): Promise<PublicAuthResult> {
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) {
      return { ok: false, error: 'not_configured', message: 'Authentication is not configured yet.' };
    }
    const passCheck = validatePassword(input.newPassword);
    if (!passCheck.ok) return { ok: false, error: 'invalid_form', message: passCheck.message };
    const client = serverClient(env.url, env.publishableKey);
    const { data, error } = await client.auth.updateUser({ password: input.newPassword });
    if (error) return mapError(error);
    return { ok: true, user: data.user ? toAuthUser(data.user) : null, requiresEmailVerification: false };
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) return null;
    const adapter = createSsrCookieAdapter();
    const client = createServerClient(env.url, env.publishableKey, {
      cookies: { getAll: () => adapter.getAll(), setAll: (cookies) => adapter.setAll(cookies) },
    });
    // getUser() verifies the access token server-side and triggers a refresh
    // when it is expired (the new tokens are written through the adapter).
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return toAuthUser(data.user);
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

export type { CookieOptions };
