import { createFileRoute, Link } from '@tanstack/react-router';
import { t } from '../i18n';
import '../styles/app.css';

/** `/checkout/cancel` — the session was cancelled; nothing was charged. */
function CheckoutCancel() {
  return (
    <main className="wrap" style={{ textAlign: 'center', padding: '90px 0' }}>
      <div className="eyebrow">{t('checkout.testBadge')}</div>
      <h1 style={{ fontSize: 'clamp(30px,5vw,52px)', margin: '14px 0' }}>{t('checkout.cancelTitle')}</h1>
      <p className="muted" style={{ maxWidth: 520, margin: '0 auto 24px' }}>
        {t('checkout.cancelBody')}
      </p>
      <Link className="btn primary" to="/strategies">
        {t('detail.backCatalog')}
      </Link>
    </main>
  );
}

export const Route = createFileRoute('/checkout/cancel')({ component: CheckoutCancel });
