/**
 * Sticky compare tray: appears once the visitor adds strategies, shows the
 * basket (max 3) and links to /compare. Shared by catalog and matcher.
 */
import { Link } from '@tanstack/react-router';
import { useCompare } from '../state/compare';
import { findProfile } from '../domain/product';
import { t } from '../i18n';

export function CompareTray() {
  const compare = useCompare();
  if (compare.ids.length === 0) return null;
  return (
    <div className="compare-tray" role="region" aria-label={t('compare.tray')}>
      <div className="wrap compare-tray-inner">
        <div className="compare-tray-items">
          {compare.ids.map((id) => {
            const profile = findProfile(id);
            return (
              <span className="compare-tray-item" key={id}>
                {profile ? profile.name : id}
                <button
                  className="compare-tray-remove"
                  aria-label={t('compare.remove')}
                  onClick={() => compare.toggle(id)}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
        <Link className="btn primary btn-sm" to="/compare">
          {t('compare.view')} ({compare.ids.length}/3) →
        </Link>
      </div>
    </div>
  );
}
