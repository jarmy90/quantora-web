import { t } from '../i18n';
import '../styles/app.css';

/** Shown when VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are absent. */
export function AuthNotConfigured() {
  return (
    <div className="auth-banner" role="status">
      <strong>{t('auth.notConfiguredTitle')}</strong>
      {t('auth.notConfiguredBody')}
    </div>
  );
}
