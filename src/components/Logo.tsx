import { Link } from '@tanstack/react-router';
import { useId } from 'react';

/**
 * Quantora brand logo: a compact gradient mark (abstract ascending signal)
 * paired with the styled wordmark. Reused in the header and footer so the
 * brand stays consistent across the whole product.
 */
export function Logo({ to = '/', size = 'md' }: { to?: string; size?: 'md' | 'lg' }) {
  const grad = useId();
  return (
    <Link to={to} className={`logo logo-${size}`} aria-label="Quantora — home">
      <span className="logo-mark" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
          <defs>
            <linearGradient id={grad} x1="0" y1="0" x2="28" y2="28">
              <stop stopColor="#c9ff5a" />
              <stop offset="1" stopColor="#72d9ff" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="24" height="24" rx="7" fill={`url(#${grad})`} />
          <path
            d="M6 17.5 L10.5 11.5 L13.5 14.5 L21.5 7"
            stroke="#0a1017"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="21.5" cy="7" r="2" fill="#0a1017" />
        </svg>
      </span>
      <span className="logo-word">
        Quantora<span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
