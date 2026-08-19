/** Shared presentation formatters (English, locale-aware). */

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const pct = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function fmtUsd(value: number): string {
  return usd.format(value);
}

export function fmtSignedUsd(value: number): string {
  return (value >= 0 ? '+' : '-') + usd.format(Math.abs(value));
}

export function fmtPct(value: number): string {
  return `${pct.format(value)}%`;
}

export function fmtNum(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function fmtDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtPeriod(start?: string, end?: string): string {
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  if (start) return fmtDate(start);
  if (end) return fmtDate(end);
  return '';
}
