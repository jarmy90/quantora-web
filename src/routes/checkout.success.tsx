import { createFileRoute, Link } from '@tanstack/react-router';
import { t } from '../i18n';
import '../styles/app.css';

/**
 * `/checkout/success` — informational only.
 *
 * This page NEVER grants access: paid/active state comes exclusively from
 * the signed Stripe webhook. It only confirms the session ended and points
 * the visitor to their account, where entitlements appear after the webhook.
 */
function CheckoutSuccess() {
  return (
    <main className="wrap" style={{ textAlign: 'center', padding: '90px 0' }}>
      <div className="eyebrow">{t('checkout.testBadge')}</div>
      <h1 style={{ fontSize: 'clamp(30px,5vw,52px)', margin: '14px 0' }}>{t('checkout.successTitle')}</h1>
      <p className="muted" style={{ maxWidth: 520, margin: '0 auto 24px' }}>
        {t('checkout.successBody')}
      </p>
      <Link className="btn primary" to="/account">
        {t('checkout.goAccount')}
      </Link>
    </main>
  );
}

export const Route = createFileRoute('/checkout/success')({ component: CheckoutSuccess });
