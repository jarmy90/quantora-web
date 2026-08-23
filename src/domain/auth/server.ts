/**
 * QNT-0013 · Auth server functions.
 *
 * Thin TanStack Start wrappers around `AuthService`. Every operation runs
 * server-side (cookies are read/written there); the client only receives
 * safe results. There is deliberately no endpoint that returns tokens.
 */
import { createServerFn } from '@tanstack/react-start';
import type { Validator } from '@tanstack/router-core';
import { getSupabaseEnv } from '../../lib/supabase/env';
import type { AuthUser } from './contracts';
import { getAuthService } from './service';

export type AuthStatusPayload = {
  configured: boolean;
  user: AuthUser | null;
};

type SignUpData = { email: string; password: string; displayName?: string; returnTo?: string };
type SignInData = { email: string; password: string; returnTo?: string };
type ResetData = { email: string };
type UpdatePasswordData = { newPassword: string };

/** Inline validator: passes the payload through with the declared shape. */
function typed<T>(): Validator<T | undefined, T> {
  return { parse: (input: T | undefined) => (input ?? ({} as T)) };
}

/** Narrow a possibly-undefined strict-mode payload to its declared shape. */
function payload<T>(data: T | undefined): T {
  if (data === undefined) throw new Error('Missing request payload');
  return data;
}

/** Used by the Nav and /account to learn the current session (no tokens). */
export const getAuthStatus = createServerFn().handler(async (): Promise<AuthStatusPayload> => {
  const env = getSupabaseEnv();
  if (env.state !== 'configured') return { configured: false, user: null };
  const user = await getAuthService().getCurrentUser();
  return { configured: true, user };
});

export const signUp = createServerFn({ method: 'POST' })
  .validator(typed<SignUpData>())
  .handler(async ({ data }) => {
    const input = payload(data);
    return getAuthService().signUp({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      returnTo: input.returnTo,
    });
  });

export const signIn = createServerFn({ method: 'POST' })
  .validator(typed<SignInData>())
  .handler(async ({ data }) => {
    const input = payload(data);
    return getAuthService().signIn({ email: input.email, password: input.password, returnTo: input.returnTo });
  });

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  return getAuthService().signOut();
});

export const requestPasswordReset = createServerFn({ method: 'POST' })
  .validator(typed<ResetData>())
  .handler(async ({ data }) => {
    const input = payload(data);
    return getAuthService().requestPasswordReset({ email: input.email });
  });

export const updatePassword = createServerFn({ method: 'POST' })
  .validator(typed<UpdatePasswordData>())
  .handler(async ({ data }) => {
    const input = payload(data);
    return getAuthService().updatePassword({ newPassword: input.newPassword });
  });
