import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useEffect, useRef } from 'react';
import { getSupabaseEnv } from '../lib/supabase/env';
import { createServerClient } from '@supabase/ssr';
import { sanitizeReturnTo } from '../domain/auth/contracts';
import { createSsrCookieAdapter } from '../domain/auth/ssr-cookies';
import { t } from '../i18n';
import '../styles/app.css';

/**
 * Server-side PKCE exchange: swaps the `code` for a session through
 * createServerClient, which persists BOTH tokens via the SSR cookie adapter
 * (renewable session). The verifier is read from its HttpOnly cookie.
 */
const exchangeCode = createServerFn({ method: 'POST' })
  .validator({ parse: (input: unknown) => input as { code: string; type?: string; returnTo?: string } })
  .handler(async ({ data }) => {
    if (data === undefined) return { ok: false as const, redirect: null as string | null };
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) {
      return { ok: false as const, redirect: null as string | null };
    }
    const adapter = createSsrCookieAdapter();
    const client = createServerClient(env.url, env.publishableKey, {
      cookies: { getAll: () => adapter.getAll(), setAll: (cookies) => adapter.setAll(cookies) },
    });
    const { data: sessionData, error } = await client.auth.exchangeCodeForSession(data.code);
    if (error || !sessionData.session) {
      return { ok: false as const, redirect: null as string | null };
    }
    const safe = sanitizeReturnTo(data.returnTo);
    if (safe && safe !== '/') return { ok: true as const, redirect: safe };
    // A password-recovery exchange lands on the new-password page; anything
    // else goes to the account area.
    const redirect = data.type === 'recovery' ? '/reset-password' : '/account';
    return { ok: true as const, redirect };
  });

export const Route = createFileRoute('/auth/callback')({
  head: () => ({
    meta: [
      { title: 'Confirming… · Quantora' },
      { name: 'description', content: 'Confirming your Quantora account.' },
    ],
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const search = useSearch({ from: '/auth/callback' }) as { code?: string; type?: string; returnTo?: string };
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!search.code) {
        await navigate({ to: '/login' });
        return;
      }
      const result = await exchangeCode({
        data: { code: search.code, type: search.type, returnTo: search.returnTo },
      });
      if (result.ok && result.redirect) {
        await navigate({ to: result.redirect as never });
      } else {
        await navigate({ to: '/login' });
      }
    })();
  }, [search.code, search.returnTo, navigate]);

  return (
    <main className="wrap auth-main">
      <div className="auth-card">
        <p className="muted" role="status" aria-live="polite">
          {t('callback.processing')}
        </p>
      </div>
    </main>
  );
}
