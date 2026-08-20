/** Shared presentation formatters (English, locale-aware). */

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const pct = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

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

/** Up to two decimals, no unit (e.g. 2368.75, 11.61). */
export function fmtNumDec(value: number): string {
  return dec2.format(value);
}

/** Points value with unit: "2,368.75 pts". */
export function fmtPoints(value: number): string {
  return `${dec2.format(value)} pts`;
}

/** Signed points value with unit: "+2,368.75 pts" / "-2,368.75 pts". */
export function fmtSignedPoints(value: number): string {
  return (value >= 0 ? '+' : '-') + dec2.format(Math.abs(value)) + ' pts';
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
