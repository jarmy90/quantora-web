import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { isSupabaseConfiguredSafe } from '../lib/supabase/env';
import { AuthCard } from '../components/AuthCard';
import { AuthForm } from '../components/AuthForm';
import { AuthNotConfigured } from '../components/AuthNotConfigured';
import { t } from '../i18n';
import '../styles/app.css';

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'Sign in · Quantora' },
      {
        name: 'description',
        content: 'Sign in to your Quantora account to follow strategies and manage access.',
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = useSearch({ from: '/login' }) as { returnTo?: string };
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => { setConfigured(isSupabaseConfiguredSafe()); }, []);

  if (configured === false) {
    return (
      <AuthCard eyebrow={t('auth.eyebrow')} title={t('login.title')} body={t('login.body')}>
        <AuthNotConfigured />
        <p className="auth-links">
          <Link to="/">{t('auth.backHome')}</Link>
        </p>
      </AuthCard>
    );
  }
  return (
    <AuthCard eyebrow={t('auth.eyebrow')} title={t('login.title')} body={t('login.body')}>
      <AuthForm mode="login" returnTo={search.returnTo} />
      <div className="auth-links">
        <Link to="/register">{t('login.registerLink')}</Link>
        <Link to="/forgot-password">{t('login.forgotLink')}</Link>
      </div>
    </AuthCard>
  );
}