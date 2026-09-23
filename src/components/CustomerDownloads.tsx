/**
 * QNT-0043 · Customer downloads (protected EA delivery).
 *
 * Read-only list driven by the access view from `getDownloadAccess`: only
 * products the endpoint would actually serve render a download button (which
 * is a plain link to `GET /api/downloads?product=<id>`, so the signed URL is
 * minted server-side per click and expires in 5 minutes). With flags off, no
 * session, no licence or no configuration it renders nothing — never a dead
 * button and never a direct file URL.
 */
import { useState } from 'react';
import { t } from '../i18n';
import { getDownloadAccess, type DownloadAccessView } from '../domain/delivery/server';

type Props = {
  productIds: string[];
};

export function CustomerDownloads({ productIds }: Props) {
  const [entries, setEntries] = useState<Record<string, DownloadAccessView> | null>(null);
  const [checked, setChecked] = useState(false);
  if (!checked) {
    setChecked(true);
    void (async () => {
      try {
        const result = await getDownloadAccess({ data: { productIds } });
        setEntries(result.entries);
      } catch {
        setEntries({});
      }
    })();
  }
  const allowed = Object.entries(entries ?? {}).filter(([, view]) => view.allowed);
  if (entries === null) {
    return <p>{t('auth.loading')}</p>;
  }
  if (allowed.length === 0) {
    return <p>{t('account.downloadsEmpty')}</p>;
  }
  return (
    <ul className="rule-list">
      {allowed.map(([productId]) => (
        <li key={productId}>
          <a className="btn" href={`/api/downloads?product=${encodeURIComponent(productId)}`}>
            {t('account.downloadCta')} · {productId}
          </a>
        </li>
      ))}
    </ul>
  );
}
