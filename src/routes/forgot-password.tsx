import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { isSupabaseConfiguredSafe } from '../lib/supabase/env';
import { AuthCard } from '../components/AuthCard';
import { AuthForm } from '../components/AuthForm';
import { AuthNotConfigured } from '../components/AuthNotConfigured';
import { t } from '../i18n';
import '../styles/app.css';

export const Route = createFileRoute('/forgot-password')({
  head: () => ({
    meta: [
      { title: 'Reset password · Quantora' },
      {
        name: 'description',
        content: 'Request a secure link to reset your Quantora account password.',
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => { setConfigured(isSupabaseConfiguredSafe()); }, []);

  return (
    <AuthCard eyebrow={t('auth.eyebrow')} title={t('forgot.title')} body={t('forgot.body')}>
      {configured === false ? <AuthNotConfigured /> : null}
      <AuthForm mode="forgot" />
      <div className="auth-links">
        <Link to="/login">{t('forgot.backToLogin')}</Link>
      </div>
    </AuthCard>
  );
}