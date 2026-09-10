/**
 * QNT-0025 · Checkout CTAs (Stripe Test Mode).
 *
 * Rendered ONLY when payments are enabled via the server-only flag
 * (PAYMENTS_ENABLED). The resolved mode (server catalog payload) decides
 * visibility — never a client-side guess. CTAs post to the authenticated
 * server function createTestCheckoutSession; the client never sends prices.
 */
import { useState } from 'react';
import { t } from '../i18n';
import { createTestCheckoutSession } from '../domain/payments/server';

export function CheckoutCtas({ productId }: { productId: string }) {
  const [busy, setBusy] = useState<'purchase' | 'rental' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(billingModel: 'purchase' | 'rental') {
    setBusy(billingModel);
    setError(null);
    try {
      const result = await createTestCheckoutSession({ data: { productId, billingModel } });
      if (!result.ok) {
        setError(t(result.error === 'auth_required' ? 'checkout.signInRequired' : 'checkout.unavailable'));
        return;
      }
      window.location.href = result.url;
    } catch {
      setError(t('checkout.unavailable'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card" style={{ marginTop: 15 }} aria-label={t('checkout.title')}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        {t('checkout.testBadge')}
      </div>
      <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>{t('checkout.title')}</h2>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: '0 0 14px' }}>
        {t('checkout.body')}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn primary"
          disabled={busy !== null}
          onClick={() => void start('purchase')}
        >
          {busy === 'purchase' ? t('checkout.redirecting') : t('checkout.buy')}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={() => void start('rental')}>
          {busy === 'rental' ? t('checkout.redirecting') : t('checkout.rent')}
        </button>
      </div>
      {error && (
        <p role="alert" className="muted" style={{ fontSize: 13, margin: '12px 0 0' }}>
          {error}
        </p>
      )}
    </section>
  );
}
