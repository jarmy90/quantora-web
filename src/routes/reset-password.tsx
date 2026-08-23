import { createFileRoute, Link } from '@tanstack/react-router';
import { isSupabaseConfigured } from '../lib/supabase/env';
import { AuthCard } from '../components/AuthCard';
import { AuthForm } from '../components/AuthForm';
import { AuthNotConfigured } from '../components/AuthNotConfigured';
import { t } from '../i18n';
import '../styles/app.css';

/**
 * Reachable from the recovery email link. The service validates the session
 * (the reset link flow in Supabase exchanges a recovery code for a session
 * in /auth/callback and redirects here with the fresh cookie).
 */
export const Route = createFileRoute('/reset-password')({
  head: () => ({
    meta: [
      { title: 'New password · Quantora' },
      {
        name: 'description',
        content: 'Choose a new password for your Quantora account.',
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <AuthCard eyebrow={t('auth.eyebrow')} title={t('reset.title')} body={t('reset.body')}>
      {!isSupabaseConfigured() ? <AuthNotConfigured /> : null}
      <AuthForm mode="reset" />
      <div className="auth-links">
        <Link to="/login">{t('reset.backToLogin')}</Link>
      </div>
    </AuthCard>
  );
}
