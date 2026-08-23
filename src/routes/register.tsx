import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { isSupabaseConfigured } from '../lib/supabase/env';
import { AuthCard } from '../components/AuthCard';
import { AuthForm } from '../components/AuthForm';
import { AuthNotConfigured } from '../components/AuthNotConfigured';
import { t } from '../i18n';
import '../styles/app.css';

export const Route = createFileRoute('/register')({
  head: () => ({
    meta: [
      { title: 'Create account · Quantora' },
      {
        name: 'description',
        content: 'Create your Quantora account to discover, follow and manage strategies with clarity.',
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const search = useSearch({ from: '/register' }) as { returnTo?: string };
  return (
    <AuthCard eyebrow={t('auth.eyebrow')} title={t('register.title')} body={t('register.body')}>
      {!isSupabaseConfigured() ? <AuthNotConfigured /> : null}
      <AuthForm mode="register" returnTo={search.returnTo} />
      <div className="auth-links">
        <Link to="/login">{t('register.loginLink')}</Link>
      </div>
    </AuthCard>
  );
}
