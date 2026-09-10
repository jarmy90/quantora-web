/**
 * QNT-0025 · Billing history (Stripe Test Mode).
 *
 * Read-only list fed by the server function getBillingHistory. Renders the
 * order/payment/entitlement snapshot for the signed-in customer. With flags
 * off or no session it renders the honest empty state — never checkout.
 */
import { useState } from 'react';
import { t } from '../i18n';
import { getBillingHistory, type BillingHistoryEntry } from '../domain/payments/history';

export function BillingHistory() {
  const [entries, setEntries] = useState<BillingHistoryEntry[] | null>(null);
  const [checked, setChecked] = useState(false);
  if (!checked) {
    setChecked(true);
    void (async () => {
      try {
        const result = await getBillingHistory();
        setEntries(result.entries);
      } catch {
        setEntries([]);
      }
    })();
  }
  if (entries === null) {
    return <p>{t('auth.loading')}</p>;
  }
  if (entries.length === 0) {
    return <p>{t('billing.empty')}</p>;
  }
  return (
    <ul className="rule-list">
      {entries.map((entry) => (
        <li key={entry.orderId}>
          {entry.displayName} — {entry.billingModel === 'purchase' ? t('checkout.buy') : t('checkout.rent')} —{' '}
          {t(`billing.status.${entry.status}` as never)}
        </li>
      ))}
    </ul>
  );
}
