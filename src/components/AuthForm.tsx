import { useRouter } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { signIn, signUp, requestPasswordReset, updatePassword } from '../domain/auth/server';
import { sanitizeReturnTo } from '../domain/auth/contracts';
import { validateDisplayName, validateEmail, validatePassword } from '../domain/auth/validation';
import { t } from '../i18n';
import '../styles/app.css';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

/**
 * Accessible, keyboard-friendly auth form. Every submit calls a TanStack
 * server function (never the SDK directly), validates before sending, and
 * announces results via aria-live. On success it follows the safe `returnTo`.
 */
export function AuthForm({
  mode,
  returnTo,
}: {
  mode: AuthMode;
  returnTo?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const target = sanitizeReturnTo(returnTo) ?? '/account';

  function localValidate(): boolean {
    setError(null);
    if (mode === 'login' || mode === 'register' || mode === 'forgot') {
      const emailCheck = validateEmail(email);
      if (!emailCheck.ok) {
        setError(emailCheck.message);
        emailRef.current?.focus();
        return false;
      }
    }
    if (mode === 'login' || mode === 'register' || mode === 'reset') {
      const passCheck = validatePassword(password);
      if (!passCheck.ok) {
        setError(passCheck.message);
        passwordRef.current?.focus();
        return false;
      }
    }
    if (mode === 'register') {
      const nameCheck = validateDisplayName(displayName);
      if (!nameCheck.ok) {
        setError(nameCheck.message);
        return false;
      }
    }
    return true;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!localValidate()) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      if (mode === 'login') {
        const result = await signIn({ data: { email, password, returnTo: target } });
        if (!result.ok) {
          setError(result.message);
        } else {
          setDone(t('login.success'));
          await router.navigate({ to: result.user ? (target as never) : '/account' });
        }
      } else if (mode === 'register') {
        const result = await signUp({
          data: { email, password, displayName: displayName.trim() || undefined, returnTo: target },
        });
        if (!result.ok) {
          setError(result.message);
        } else if (result.requiresEmailVerification) {
          setDone(t('register.checkYourEmail'));
        } else {
          setDone(t('register.success'));
          await router.navigate({ to: '/account' });
        }
      } else if (mode === 'forgot') {
        const result = await requestPasswordReset({ data: { email } });
        if (!result.ok) setError(result.message);
        else setDone(t('forgot.sentBody'));
      } else {
        const result = await updatePassword({ data: { newPassword: password } });
        if (!result.ok) setError(result.message);
        else setDone(t('reset.success'));
      }
    } catch {
      setError(t('forgot.error'));
    } finally {
      setBusy(false);
    }
  }

  const showEmail = mode === 'login' || mode === 'register' || mode === 'forgot';
  const showPassword = mode === 'login' || mode === 'register' || mode === 'reset';

  return (
    <form onSubmit={onSubmit} noValidate>
      {showEmail && (
        <div className="auth-field">
          <label htmlFor={`${mode}-email`}>{t(mode === 'register' ? 'register.emailLabel' : mode === 'forgot' ? 'forgot.emailLabel' : 'login.emailLabel')}</label>
          <input
            id={`${mode}-email`}
            ref={emailRef}
            className="auth-input"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      )}
      {mode === 'register' && (
        <div className="auth-field">
          <label htmlFor="register-name">{t('register.displayNameLabel')}</label>
          <input
            id="register-name"
            className="auth-input"
            type="text"
            name="displayName"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
      )}
      {showPassword && (
        <div className="auth-field">
          <label htmlFor={`${mode}-password`}>{t(mode === 'reset' ? 'reset.passwordLabel' : 'login.passwordLabel')}</label>
          <input
            id={`${mode}-password`}
            ref={passwordRef}
            className="auth-input"
            type="password"
            name="password"
            autoComplete={mode === 'reset' ? 'new-password' : mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mode === 'register' && <p className="auth-hint">{t('register.passwordHint')}</p>}
        </div>
      )}

      {done ? (
        <p className="auth-success" role="status" aria-live="polite">
          {done}
        </p>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}

      <div className="auth-actions">
        <button type="submit" className="btn primary auth-submit" disabled={busy}>
          {busy
            ? t('auth.loading')
            : t(mode === 'login' ? 'login.submit' : mode === 'register' ? 'register.submit' : mode === 'forgot' ? 'forgot.submit' : 'reset.submit')}
        </button>
      </div>
    </form>
  );
}
