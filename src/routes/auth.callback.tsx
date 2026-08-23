import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useEffect, useRef } from 'react';
import { getSupabaseEnv } from '../lib/supabase/env';
import { createClient } from '@supabase/supabase-js';
import { sanitizeReturnTo } from '../domain/auth/contracts';
import { setResponseHeader } from '@tanstack/react-start-server';
import { t } from '../i18n';
import '../styles/app.css';

/** Server-side PKCE exchange: swaps the `code` for a session and sets the cookie. */
const exchangeCode = createServerFn({ method: 'POST' })
  .validator({ parse: (input: unknown) => input as { code: string; type?: string; returnTo?: string } })
  .handler(async ({ data }) => {
    if (data === undefined) return { ok: false as const, redirect: null as string | null };
    const env = getSupabaseEnv();
    if (env.state !== 'configured' || !env.url || !env.publishableKey) {
      return { ok: false as const, redirect: null as string | null };
    }
    const client = createClient(env.url, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sessionData, error } = await client.auth.exchangeCodeForSession(data.code);
    if (error || !sessionData.session) {
      return { ok: false as const, redirect: null as string | null };
    }
    const secure = Boolean(import.meta.env.PROD) || Boolean((import.meta.env.VITE_SITE_URL as string | undefined)?.startsWith('https'));
    const cookie = [
      `quantora-auth-token=${encodeURIComponent(sessionData.session.access_token)}`,
      'Max-Age=604800',
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      secure ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');
    setResponseHeader('set-cookie', cookie);
    const safe = sanitizeReturnTo(data.returnTo);
    if (safe && safe !== '/') return { ok: true as const, redirect: safe };
    // A password-recovery exchange lands on the new-password page; anything
    // else goes to the account area.
    const redirect = data.type === 'recovery' ? '/reset-password' : '/account';
    return { ok: true as const, redirect };
  },
);

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
