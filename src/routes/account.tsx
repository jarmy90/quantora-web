import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { getAuthStatus, signOut } from '../domain/auth/server';
import { commercialCatalog } from '../commercial/catalog';
import { t } from '../i18n';
import '../styles/app.css';

export const Route = createFileRoute('/account')({
  head: () => ({
    meta: [
      { title: 'Your account · Quantora' },
      {
        name: 'description',
        content: 'Your Quantora account: strategies, licenses and billing.',
      },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const status = await getAuthStatus();
    if (!status.user) {
      const returnTo = location.pathname === '/account' ? undefined : location.pathname;
      throw redirect({
        to: '/login',
        search: returnTo ? ({ returnTo } as never) : ({} as never),
      });
    }
  },
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<{ user: { id: string; email: string | null; displayName: string | null; emailVerified: boolean } } | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const user = status?.user;

  // The guard ran server-side; this light client call refreshes the snapshot
  // after any client-side navigation without duplicating the check.
  void (async () => {
    if (!status) {
      const next = await getAuthStatus();
      setStatus(next as never);
    }
  })();

  async function onSignOut() {
    setSigningOut(true);
    await signOut();
    await navigate({ to: '/login' });
  }

  if (!user) {
    return (
      <>
        <Nav />
        <main className="wrap auth-account">
          <p className="muted" role="status" aria-live="polite">
            {t('auth.loading')}
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="wrap auth-account">
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {t('account.eyebrow')}
          </div>
          <h1 className="auth-hello">
            {t('account.welcome')}, {user.displayName ?? user.email ?? ''}
          </h1>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
            {user.email}
          </p>
          <span className="auth-badge">
            <span className={`dot ${user.emailVerified ? '' : 'amber'}`} />
            {user.emailVerified ? t('account.emailVerified') : t('account.emailUnverified')}
          </span>
        </div>

        <div className="auth-box">
          <h2>{t('account.strategies')}</h2>
          <p>{t('account.strategiesEmpty')}</p>
        </div>
        <div className="auth-box">
          <h2>{t('account.licenses')}</h2>
          <p>{t('account.licensesEmpty')}</p>
        </div>
        <div className="auth-box">
          <h2>{t('account.billing')}</h2>
          <p>{t('account.billingEmpty')}</p>
        </div>
        <div className="auth-box">
          <h2>{t('account.products')}</h2>
          <p>{t('account.productsEmpty')}</p>
          <ul className="account-products">
            {commercialCatalog.map((product) => (
              <li key={product.productId}>
                <span>{product.displayName} · <span className="muted">{t('account.productStatus')}</span></span>
                <Link className="btn" to="/products/$productId" params={{ productId: product.productId } as never}>
                  {t('account.productOptions')} →
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="auth-box">
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('easy.accountEyebrow')}</div>
          <h2>{t('easy.homeTitle')}</h2>
          <p>{t('easy.accountBody')}</p>
          <Link className="btn" to="/how-to-install" style={{ marginTop: 12 }}>
            {t('easy.accountCta')} →
          </Link>
        </div>

        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          {t('account.accessNote')}
        </p>

        <button type="button" className="btn auth-submit" style={{ maxWidth: 220 }} onClick={onSignOut} disabled={signingOut}>
          {signingOut ? t('auth.loading') : t('account.signOut')}
        </button>
      </main>
      <Footer />
    </>
  );
}
