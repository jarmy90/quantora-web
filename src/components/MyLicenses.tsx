/**
 * QNT-0045 · "My licences" (account area).
 *
 * Shows the key the customer must paste into the EA and until when it is
 * valid. Read-only: the key is issued server-side when the payment settles and
 * it is bound to the first MT5 account that uses it, so sharing it is useless.
 */
import { useState } from 'react';
import { t } from '../i18n';
import { getMyLicenses, type CustomerLicenseView } from '../domain/licenses/server';

function expiryLabel(license: CustomerLicenseView): string {
  if (license.expiresAt === null) return t('licenses.perpetual');
  const date = new Date(license.expiresAt);
  if (Number.isNaN(date.getTime())) return t('licenses.perpetual');
  return date.toISOString().slice(0, 10);
}

export function MyLicenses() {
  const [licenses, setLicenses] = useState<CustomerLicenseView[] | null>(null);
  const [checked, setChecked] = useState(false);
  if (!checked) {
    setChecked(true);
    void (async () => {
      try {
        const result = await getMyLicenses();
        setLicenses(result.licenses);
      } catch {
        setLicenses([]);
      }
    })();
  }
  if (licenses === null) return <p>{t('auth.loading')}</p>;
  if (licenses.length === 0) return <p>{t('account.licensesEmpty')}</p>;
  return (
    <ul className="rule-list">
      {licenses.map((license) => (
        <li key={license.licenseId}>
          <strong>{license.displayName}</strong> —{' '}
          {license.usable ? t('licenses.validUntil') : t('licenses.inactive')}{' '}
          {license.usable ? expiryLabel(license) : ''}
          <br />
          <code>{license.licenseKey ?? '—'}</code>
          {license.boundAccount ? ` · ${t('licenses.boundTo')} ${license.boundAccount}` : ''}
        </li>
      ))}
    </ul>
  );
}
