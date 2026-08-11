/**
 * V2B — CSV parser & validator for owner backtest datasets.
 *
 * Designed for the StochExtreme-style delivery (one CSV per entity):
 *   - manifest.csv          (one row: version, symbol, period, ticks, …)
 *   - strategy_config.csv   (rules: schedule, K thresholds, stop, …)
 *   - coverage.csv          (sample coverage / quality)
 *   - events.csv            (structural WIN/LOSS events)
 *   - symbol_specifications.csv
 *   - trades.csv            (per-trade: side, dates, prices, pnl, structural)
 *   - equity.csv            (timestamp, equity, balance, drawdown)
 *
 * The parser is intentionally strict and dependency-free: it splits on
 * newlines/commas, does NOT handle embedded commas in quoted fields (owner
 * exports use clean numeric CSVs). Every parsing problem becomes a readable
 * { row, column, message } error; valid rows are returned as typed records.
 * Numbers and dates are validated; nothing is estimated or inferred.
 */
import type {
  NormalizedTrade,
  EquityPoint,
  StructuralOutcome,
} from './analytics';

export type CsvRow = Record<string, string>;

export type CsvParseError = {
  row: number; // 1-based data row (0 = header error)
  column?: string;
  message: string;
};

export type CsvParseResult<T> = {
  rows: T[];
  errors: CsvParseError[];
  /** Number of raw data rows seen (excluding header). */
  rawRowCount: number;
};

/** Split a CSV string into header + raw string rows. Throws on malformed shape. */
export function splitCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (!lines.length) throw new Error('CSV is empty.');
  const headers = lines[0]!.split(',').map((h) => h.trim());
  if (headers.some((h) => h.length === 0))
    throw new Error('CSV header contains an empty column.');
  const rows = lines.slice(1).map((l) => l.split(','));
  return { headers, rows };
}

const num = (v: string): number | undefined => {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

const iso = (v: string): string | undefined => {
  const t = v.trim();
  if (t === '') return undefined;
  const parsed = Date.parse(t);
  return Number.isNaN(parsed) ? undefined : t;
};

const side = (v: string): 'buy' | 'sell' | undefined => {
  const t = v.trim().toLowerCase();
  if (t === 'buy' || t === 'b' || t === 'long') return 'buy';
  if (t === 'sell' || t === 's' || t === 'short') return 'sell';
  return undefined;
};

const structural = (v: string): StructuralOutcome | undefined => {
  const t = v.trim().toLowerCase();
  if (t === 'win' || t === 'w') return 'win';
  if (t === 'loss' || t === 'l') return 'loss';
  return undefined;
};

function rowToRecord(headers: string[], cells: string[]): CsvRow {
  const rec: CsvRow = {};
  headers.forEach((h, i) => {
    rec[h] = (cells[i] ?? '').trim();
  });
  return rec;
}

/** Parse trades.csv → NormalizedTrade[]. Strict: every required field must parse. */
export function parseTradesCsv(text: string): CsvParseResult<NormalizedTrade> {
  const out: NormalizedTrade[] = [];
  const errors: CsvParseError[] = [];
  let headers: string[];
  let rows: string[][];
  try {
    ({ headers, rows } = splitCsv(text));
  } catch (e) {
    return { rows: [], errors: [{ row: 0, message: e instanceof Error ? e.message : 'parse failed' }], rawRowCount: 0 };
  }
  const required = ['id', 'side', 'openedAt', 'symbol', 'quantity', 'entryPrice'];
  for (const r of required) {
    if (!headers.includes(r))
      errors.push({ row: 0, column: r, message: `Missing required column "${r}".` });
  }
  if (errors.length) return { rows: [], errors, rawRowCount: rows.length };

  rows.forEach((cells, i) => {
    const rowNum = i + 2; // header is row 1
    if (cells.length !== headers.length) {
      errors.push({ row: rowNum, message: `Expected ${headers.length} columns, got ${cells.length}.` });
      return;
    }
    const r = rowToRecord(headers, cells);
    const s = side(r.side!);
    if (!s) errors.push({ row: rowNum, column: 'side', message: `Invalid side "${r.side}".` });
    const openedAt = iso(r.openedAt!);
    if (!openedAt) errors.push({ row: rowNum, column: 'openedAt', message: `Invalid openedAt "${r.openedAt}".` });
    const quantity = num(r.quantity!);
    if (quantity === undefined) errors.push({ row: rowNum, column: 'quantity', message: `Invalid quantity "${r.quantity}".` });
    const entryPrice = num(r.entryPrice!);
    if (entryPrice === undefined) errors.push({ row: rowNum, column: 'entryPrice', message: `Invalid entryPrice "${r.entryPrice}".` });
    const closedAt = r.closedAt ? iso(r.closedAt) : undefined;
    if (r.closedAt && !closedAt) errors.push({ row: rowNum, column: 'closedAt', message: `Invalid closedAt "${r.closedAt}".` });
    const exitPrice = r.exitPrice ? num(r.exitPrice) : undefined;
    if (r.exitPrice && exitPrice === undefined) errors.push({ row: rowNum, column: 'exitPrice', message: `Invalid exitPrice "${r.exitPrice}".` });
    const pnlUsd = r.pnlUsd ? num(r.pnlUsd) : undefined;
    if (r.pnlUsd && pnlUsd === undefined) errors.push({ row: rowNum, column: 'pnlUsd', message: `Invalid pnlUsd "${r.pnlUsd}".` });
    const feesUsd = r.feesUsd ? num(r.feesUsd) : undefined;
    if (r.feesUsd && feesUsd === undefined) errors.push({ row: rowNum, column: 'feesUsd', message: `Invalid feesUsd "${r.feesUsd}".` });
    const st = r.structural ? structural(r.structural) : undefined;
    if (r.structural && !st) errors.push({ row: rowNum, column: 'structural', message: `Invalid structural "${r.structural}".` });
    // Only push a trade row when the required fields are valid; partial rows are reported.
    if (s && openedAt && quantity !== undefined && entryPrice !== undefined) {
      out.push({
        id: r.id!,
        side: s,
        openedAt,
        closedAt,
        symbol: r.symbol!,
        quantity,
        entryPrice,
        exitPrice,
        pnlUsd,
        feesUsd,
        structural: st,
      });
    }
  });
  return { rows: out, errors, rawRowCount: rows.length };
}

/** Parse equity.csv → EquitySeries. */
export function parseEquityCsv(text: string): CsvParseResult<EquityPoint> {
  const out: EquityPoint[] = [];
  const errors: CsvParseError[] = [];
  let headers: string[];
  let rows: string[][];
  try {
    ({ headers, rows } = splitCsv(text));
  } catch (e) {
    return { rows: [], errors: [{ row: 0, message: e instanceof Error ? e.message : 'parse failed' }], rawRowCount: 0 };
  }
  for (const r of ['timestamp', 'equity']) {
    if (!headers.includes(r)) errors.push({ row: 0, column: r, message: `Missing required column "${r}".` });
  }
  if (errors.length) return { rows: [], errors, rawRowCount: rows.length };

  rows.forEach((cells, i) => {
    const rowNum = i + 2;
    if (cells.length !== headers.length) {
      errors.push({ row: rowNum, message: `Expected ${headers.length} columns, got ${cells.length}.` });
      return;
    }
    const r = rowToRecord(headers, cells);
    const timestamp = iso(r.timestamp!);
    if (!timestamp) { errors.push({ row: rowNum, column: 'timestamp', message: `Invalid timestamp "${r.timestamp}".` }); return; }
    const equity = num(r.equity!);
    if (equity === undefined) { errors.push({ row: rowNum, column: 'equity', message: `Invalid equity "${r.equity}".` }); return; }
    const balance = r.balance ? num(r.balance) : undefined;
    const drawdownUsd = r.drawdownUsd ? num(r.drawdownUsd) : undefined;
    const drawdownPct = r.drawdownPct ? num(r.drawdownPct) : undefined;
    out.push({ timestamp, equity, balance, drawdownUsd, drawdownPct });
  });
  return { rows: out, errors, rawRowCount: rows.length };
}

/** Parse a manifest.csv (single descriptive row) into a string map. */
export function parseManifestCsv(text: string): CsvParseResult<CsvRow> {
  const out: CsvRow[] = [];
  const errors: CsvParseError[] = [];
  let headers: string[];
  let rows: string[][];
  try {
    ({ headers, rows } = splitCsv(text));
  } catch (e) {
    return { rows: [], errors: [{ row: 0, message: e instanceof Error ? e.message : 'parse failed' }], rawRowCount: 0 };
  }
  rows.forEach((cells, i) => {
    const rowNum = i + 2;
    if (cells.length !== headers.length) {
      errors.push({ row: rowNum, message: `Expected ${headers.length} columns, got ${cells.length}.` });
      return;
    }
    out.push(rowToRecord(headers, cells));
  });
  return { rows: out, errors, rawRowCount: rows.length };
}

/** Generic per-entity CSV parse used by the publish/admin preview. */
export type PreviewableEntity = 'trades' | 'equity' | 'manifest';

export function previewCsv(entity: PreviewableEntity, text: string): CsvParseResult<unknown> {
  switch (entity) {
    case 'trades':
      return parseTradesCsv(text) as CsvParseResult<unknown>;
    case 'equity':
      return parseEquityCsv(text) as CsvParseResult<unknown>;
    case 'manifest':
      return parseManifestCsv(text) as CsvParseResult<unknown>;
  }
}

/** Detect a likely entity from a filename (best-effort, never throws). */
export function detectEntity(filename: string): PreviewableEntity | null {
  const f = filename.toLowerCase();
  if (f.includes('trade')) return 'trades';
  if (f.includes('equity')) return 'equity';
  if (f.includes('manifest')) return 'manifest';
  return null;
}

/** Honest size guard: refuse absurdly large inline pastes in the preview. */
export const PREVIEW_MAX_ROWS = 5000;
export const PREVIEW_MAX_BYTES = 2_000_000;

export function withinPreviewLimits(text: string, rowCount: number): string | null {
  if (text.length > PREVIEW_MAX_BYTES) return `CSV exceeds the ${PREVIEW_MAX_BYTES} byte preview limit.`;
  if (rowCount > PREVIEW_MAX_ROWS) return `CSV exceeds the ${PREVIEW_MAX_ROWS} row preview limit.`;
  return null;
}
