/**
 * Quantora dataset validation (QNT-0002F).
 *
 * Pure and non-throwing: `validateDataset` accepts `unknown` and always returns
 * `ValidationIssue[]`, even for null, primitives, root arrays and unsafe
 * collection elements. It never mutates its input.
 *
 * Validation is layered:
 *   1. structural (root shape, modelVersion, required collections),
 *   2. per-entity structural (all contract fields, enums, dates, metrics,
 *      provenance, numbers),
 *   3. referential (bidirectional integrity over safe collections only).
 *
 * Referential phases only dereference entities that are plain objects with a
 * valid, globally-unique id ("safe collections"), so unsafe elements can never
 * reach a phase that reads `.id`, `.assetIds`, `.strategyId`, etc.
 */

export type ValidationIssue = { path: string; message: string };

const MODEL_VERSION = '1.0';
const ROOT_KEYS = ['strategies', 'assets', 'backtests', 'equityCurves', 'tradeLogs'] as const;
type RootKey = (typeof ROOT_KEYS)[number];

const ASSET_CLASSES = ['crypto', 'equity', 'forex', 'future', 'other'] as const;
const STRATEGY_STATUSES = ['active', 'archived', 'draft'] as const;
const VALIDATION_STATUSES = ['mock', 'owner_supplied_under_review', 'quantora_validated', 'rejected'] as const;
const DATA_STATUSES = ['mock', 'real'] as const;
const SOURCE_TYPES = ['fixture', 'owner-delivery', 'broker-export', 'other'] as const;
const TRADE_SIDES = ['buy', 'sell'] as const;

const ISO_MSG = 'Must be an ISO 8601 timestamp with an explicit timezone offset (Z or ±HH:MM).';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const idList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(text);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function isOneOf<T extends string>(value: unknown, list: readonly T[]): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Timestamps (calendar + offset validated without relying on Date.parse)
// ---------------------------------------------------------------------------

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * Validates an ISO 8601 timestamp with an explicit offset (Z or ±HH:MM).
 * Calendar (including leap years), wall-clock time and offset ranges are all
 * checked. When `maxAbsOffsetHours` is given (used for `receivedAt`), the
 * absolute offset must not exceed it and, if it equals it, minutes must be 00.
 */
function isIsoTimestamp(value: unknown, maxAbsOffsetHours?: number): value is string {
  if (!text(value)) return false;
  const match = ISO_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const zone = match[7] as string;

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;

  if (zone === 'Z') return true;
  const offsetHours = Number(zone.slice(1, 3));
  const offsetMinutes = Number(zone.slice(4, 6));
  if (offsetHours > 23 || offsetMinutes > 59) return false;
  if (maxAbsOffsetHours !== undefined) {
    if (offsetHours > maxAbsOffsetHours) return false;
    if (offsetHours === maxAbsOffsetHours && offsetMinutes !== 0) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Shared entity plumbing
// ---------------------------------------------------------------------------

type Ctx = {
  issues: ValidationIssue[];
  seenIds: Set<string>;
  strategyById: Map<string, Record<string, unknown>>;
  assetById: Map<string, Record<string, unknown>>;
  backtestById: Map<string, Record<string, unknown>>;
  equityCurveById: Map<string, Record<string, unknown>>;
  tradeLogById: Map<string, Record<string, unknown>>;
  safeStrategies: SafeEntity[];
  safeAssets: SafeEntity[];
  safeBacktests: SafeEntity[];
  safeEquityCurves: SafeEntity[];
  safeTradeLogs: SafeEntity[];
};

type SafeEntity = { item: Record<string, unknown>; prefix: string };

function newCtx(): Ctx {
  return {
    issues: [],
    seenIds: new Set<string>(),
    strategyById: new Map(),
    assetById: new Map(),
    backtestById: new Map(),
    equityCurveById: new Map(),
    tradeLogById: new Map(),
    safeStrategies: [],
    safeAssets: [],
    safeBacktests: [],
    safeEquityCurves: [],
    safeTradeLogs: [],
  };
}

/**
 * Registers an entity for referential indexing when its id is a valid,
 * globally-unique string. Entities failing this are still structurally
 * inspected; they are simply not reachable by the referential phases.
 */
function registerEntity(
  ctx: Ctx,
  item: Record<string, unknown>,
  index: number,
  kind: RootKey,
  byId: Map<string, Record<string, unknown>>,
  safe: SafeEntity[],
): void {
  const path = `${kind}[${index}].id`;
  if (!text(item.id)) {
    ctx.issues.push({ path, message: 'Required non-empty id.' });
    return;
  }
  const id = item.id;
  if (ctx.seenIds.has(id)) {
    ctx.issues.push({ path, message: 'IDs must be globally unique.' });
    return;
  }
  ctx.seenIds.add(id);
  byId.set(id, item);
  safe.push({ item, prefix: `${kind}[${index}]` });
}

function eachEntity(
  kind: RootKey,
  value: unknown,
  issues: ValidationIssue[],
  fn: (item: Record<string, unknown>, index: number) => void,
): void {
  if (!Array.isArray(value)) return;
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      issues.push({ path: `${kind}[${index}]`, message: 'Expected an object.' });
      return;
    }
    fn(entry, index);
  });
}

function validateProvenance(issues: ValidationIssue[], value: unknown, path: string): void {
  if (!isRecord(value)) {
    issues.push({ path, message: 'Required provenance object.' });
    return;
  }
  if (!isOneOf(value.dataStatus, DATA_STATUSES)) {
    issues.push({ path: `${path}.dataStatus`, message: 'Must be "mock" or "real".' });
  }
  if (!text(value.sourceName)) {
    issues.push({ path: `${path}.sourceName`, message: 'Required non-empty sourceName.' });
  }
  if (value.sourceType === undefined) {
    issues.push({ path: `${path}.sourceType`, message: 'Required sourceType.' });
  } else if (!isOneOf(value.sourceType, SOURCE_TYPES)) {
    issues.push({ path: `${path}.sourceType`, message: 'Must be one of: fixture, owner-delivery, broker-export, other.' });
  }
  if (value.receivedAt !== undefined && !isIsoTimestamp(value.receivedAt, 14)) {
    issues.push({ path: `${path}.receivedAt`, message: 'Must be an ISO 8601 timestamp with an explicit offset (max ±14:00).' });
  }
  if (value.sourceFile !== undefined && !text(value.sourceFile)) {
    issues.push({ path: `${path}.sourceFile`, message: 'Must be a non-empty string.' });
  }
  if (value.notes !== undefined && typeof value.notes !== 'string') {
    issues.push({ path: `${path}.notes`, message: 'Must be a string.' });
  }
}

// ---------------------------------------------------------------------------
// Per-entity structural validation
// ---------------------------------------------------------------------------

function validateAsset(ctx: Ctx, item: Record<string, unknown>, index: number): void {
  const p = (field: string): string => `assets[${index}].${field}`;
  registerEntity(ctx, item, index, 'assets', ctx.assetById, ctx.safeAssets);
  if (!text(item.symbol)) ctx.issues.push({ path: p('symbol'), message: 'Required non-empty symbol.' });
  if (!text(item.name)) ctx.issues.push({ path: p('name'), message: 'Required non-empty name.' });
  if (!isOneOf(item.assetClass, ASSET_CLASSES)) ctx.issues.push({ path: p('assetClass'), message: 'Must be one of: crypto, equity, forex, future, other.' });
  if (item.exchange !== undefined && !text(item.exchange)) ctx.issues.push({ path: p('exchange'), message: 'Must be a non-empty string.' });
  if (item.quoteCurrency !== undefined && !text(item.quoteCurrency)) ctx.issues.push({ path: p('quoteCurrency'), message: 'Must be a non-empty string.' });
}

function validateStrategy(ctx: Ctx, item: Record<string, unknown>, index: number): void {
  const p = (field: string): string => `strategies[${index}].${field}`;
  registerEntity(ctx, item, index, 'strategies', ctx.strategyById, ctx.safeStrategies);
  if (!text(item.name)) ctx.issues.push({ path: p('name'), message: 'Required non-empty name.' });
  if (item.description !== undefined && typeof item.description !== 'string') ctx.issues.push({ path: p('description'), message: 'Must be a string.' });
  if (!text(item.version)) ctx.issues.push({ path: p('version'), message: 'Required non-empty version.' });
  if (!isOneOf(item.status, STRATEGY_STATUSES)) ctx.issues.push({ path: p('status'), message: 'Must be one of: active, archived, draft.' });
  if (!isOneOf(item.validationStatus, VALIDATION_STATUSES)) {
    ctx.issues.push({ path: p('validationStatus'), message: 'Required validationStatus: mock, owner_supplied_under_review, quantora_validated or rejected.' });
  }
  if (!idList(item.assetIds)) ctx.issues.push({ path: p('assetIds'), message: 'Must be an array of non-empty string IDs.' });
  if (!idList(item.backtestIds)) ctx.issues.push({ path: p('backtestIds'), message: 'Must be an array of non-empty string IDs.' });
  if (!isIsoTimestamp(item.createdAt)) ctx.issues.push({ path: p('createdAt'), message: ISO_MSG });
  if (!isIsoTimestamp(item.updatedAt)) ctx.issues.push({ path: p('updatedAt'), message: ISO_MSG });
  if (isIsoTimestamp(item.createdAt) && isIsoTimestamp(item.updatedAt) && Date.parse(item.createdAt) > Date.parse(item.updatedAt)) {
    ctx.issues.push({ path: p('updatedAt'), message: 'updatedAt must not be earlier than createdAt.' });
  }
  validateProvenance(ctx.issues, item.provenance, p('provenance'));

  // provenance × editorial-validation matrix (no inference, no auto-transitions)
  if (isRecord(item.provenance) && isOneOf(item.provenance.dataStatus, DATA_STATUSES) && isOneOf(item.validationStatus, VALIDATION_STATUSES)) {
    const dataStatus = item.provenance.dataStatus;
    const validationStatus = item.validationStatus;
    const valid =
      (dataStatus === 'mock' && validationStatus === 'mock') ||
      (dataStatus === 'real' &&
        (validationStatus === 'owner_supplied_under_review' || validationStatus === 'quantora_validated' || validationStatus === 'rejected'));
    if (!valid) {
      ctx.issues.push({ path: p('validationStatus'), message: 'validationStatus is incompatible with provenance.dataStatus (mock requires mock; real requires owner_supplied_under_review, quantora_validated or rejected).' });
    }
  }
}

function validateBacktest(ctx: Ctx, item: Record<string, unknown>, index: number): void {
  const p = (field: string): string => `backtests[${index}].${field}`;
  registerEntity(ctx, item, index, 'backtests', ctx.backtestById, ctx.safeBacktests);
  if (!text(item.strategyId)) ctx.issues.push({ path: p('strategyId'), message: 'Required non-empty strategyId.' });
  if (!idList(item.assetIds)) ctx.issues.push({ path: p('assetIds'), message: 'Must be an array of non-empty string IDs.' });
  if (!isIsoTimestamp(item.startedAt)) ctx.issues.push({ path: p('startedAt'), message: ISO_MSG });
  if (!isIsoTimestamp(item.endedAt)) ctx.issues.push({ path: p('endedAt'), message: ISO_MSG });
  if (isIsoTimestamp(item.startedAt) && isIsoTimestamp(item.endedAt) && Date.parse(item.startedAt) > Date.parse(item.endedAt)) {
    ctx.issues.push({ path: p('endedAt'), message: 'endedAt must not be earlier than startedAt.' });
  }
  if (!text(item.timeframe)) ctx.issues.push({ path: p('timeframe'), message: 'Required non-empty timeframe.' });
  if (!isFiniteNumber(item.initialCapital)) ctx.issues.push({ path: p('initialCapital'), message: 'Must be a finite number.' });
  if (!text(item.currency)) ctx.issues.push({ path: p('currency'), message: 'Required non-empty currency.' });
  if (!isRecord(item.metrics)) {
    ctx.issues.push({ path: p('metrics'), message: 'Required metrics object (non-null, non-array).' });
  } else {
    for (const [key, value] of Object.entries(item.metrics)) {
      if (value !== undefined && !isFiniteNumber(value)) {
        ctx.issues.push({ path: `${p('metrics')}.${key}`, message: 'Must be a finite number.' });
      }
    }
  }
  if (item.equityCurveId !== undefined && !text(item.equityCurveId)) ctx.issues.push({ path: p('equityCurveId'), message: 'Must be a non-empty string.' });
  if (!idList(item.tradeLogIds)) ctx.issues.push({ path: p('tradeLogIds'), message: 'Must be an array of non-empty string IDs.' });
  validateProvenance(ctx.issues, item.provenance, p('provenance'));
}

function validateEquityCurve(ctx: Ctx, item: Record<string, unknown>, index: number): void {
  const p = (field: string): string => `equityCurves[${index}].${field}`;
  registerEntity(ctx, item, index, 'equityCurves', ctx.equityCurveById, ctx.safeEquityCurves);
  if (!text(item.strategyId)) ctx.issues.push({ path: p('strategyId'), message: 'Required non-empty strategyId.' });
  if (!text(item.backtestId)) ctx.issues.push({ path: p('backtestId'), message: 'Required non-empty backtestId.' });
  if (!text(item.currency)) ctx.issues.push({ path: p('currency'), message: 'Required non-empty currency.' });
  if (!Array.isArray(item.points)) {
    ctx.issues.push({ path: p('points'), message: 'Must be an array.' });
  } else {
    item.points.forEach((point, pointIndex) => {
      const pp = `${p('points')}[${pointIndex}]`;
      if (!isRecord(point)) {
        ctx.issues.push({ path: pp, message: 'Expected an object.' });
        return;
      }
      if (!isIsoTimestamp(point.timestamp)) ctx.issues.push({ path: `${pp}.timestamp`, message: ISO_MSG });
      if (!isFiniteNumber(point.equity)) ctx.issues.push({ path: `${pp}.equity`, message: 'Must be a finite number.' });
      if (point.drawdown !== undefined && !isFiniteNumber(point.drawdown)) ctx.issues.push({ path: `${pp}.drawdown`, message: 'Must be a finite number.' });
      if (point.balance !== undefined && !isFiniteNumber(point.balance)) ctx.issues.push({ path: `${pp}.balance`, message: 'Must be a finite number.' });
    });
  }
  validateProvenance(ctx.issues, item.provenance, p('provenance'));
}

function validateTradeLog(ctx: Ctx, item: Record<string, unknown>, index: number): void {
  const p = (field: string): string => `tradeLogs[${index}].${field}`;
  registerEntity(ctx, item, index, 'tradeLogs', ctx.tradeLogById, ctx.safeTradeLogs);
  if (!text(item.backtestId)) ctx.issues.push({ path: p('backtestId'), message: 'Required non-empty backtestId.' });
  if (!text(item.strategyId)) ctx.issues.push({ path: p('strategyId'), message: 'Required non-empty strategyId.' });
  if (!text(item.assetId)) ctx.issues.push({ path: p('assetId'), message: 'Required non-empty assetId.' });
  if (!isOneOf(item.side, TRADE_SIDES)) ctx.issues.push({ path: p('side'), message: 'Must be "buy" or "sell".' });
  if (!isIsoTimestamp(item.openedAt)) ctx.issues.push({ path: p('openedAt'), message: ISO_MSG });
  if (item.closedAt !== undefined && !isIsoTimestamp(item.closedAt)) ctx.issues.push({ path: p('closedAt'), message: ISO_MSG });
  if (isIsoTimestamp(item.openedAt) && isIsoTimestamp(item.closedAt) && Date.parse(item.openedAt) > Date.parse(item.closedAt)) {
    ctx.issues.push({ path: p('closedAt'), message: 'closedAt must not be earlier than openedAt.' });
  }
  if (!isFiniteNumber(item.quantity)) ctx.issues.push({ path: p('quantity'), message: 'Must be a finite number.' });
  if (!isFiniteNumber(item.entryPrice)) ctx.issues.push({ path: p('entryPrice'), message: 'Must be a finite number.' });
  if (item.exitPrice !== undefined && !isFiniteNumber(item.exitPrice)) ctx.issues.push({ path: p('exitPrice'), message: 'Must be a finite number.' });
  if (item.fees !== undefined && !isFiniteNumber(item.fees)) ctx.issues.push({ path: p('fees'), message: 'Must be a finite number.' });
  if (item.pnl !== undefined && !isFiniteNumber(item.pnl)) ctx.issues.push({ path: p('pnl'), message: 'Must be a finite number.' });
  if (!text(item.currency)) ctx.issues.push({ path: p('currency'), message: 'Required non-empty currency.' });
  validateProvenance(ctx.issues, item.provenance, p('provenance'));
}

// ---------------------------------------------------------------------------
// Referential integrity (safe collections only)
// ---------------------------------------------------------------------------

function validateReferences(ctx: Ctx): void {
  // Strategy -> assets / backtests
  for (const { item: s, prefix } of ctx.safeStrategies) {
    if (idList(s.assetIds)) {
      for (const assetId of s.assetIds) {
        if (!ctx.assetById.has(assetId)) ctx.issues.push({ path: `${prefix}.assetIds`, message: `Asset "${assetId}" does not exist.` });
      }
    }
    if (idList(s.backtestIds)) {
      for (const backtestId of s.backtestIds) {
        const backtest = ctx.backtestById.get(backtestId);
        if (!backtest) {
          ctx.issues.push({ path: `${prefix}.backtestIds`, message: `Backtest "${backtestId}" does not exist.` });
        } else if (text(backtest.strategyId) && backtest.strategyId !== s.id) {
          ctx.issues.push({ path: `${prefix}.backtestIds`, message: `Backtest "${backtestId}" belongs to a different strategy.` });
        }
      }
    }
  }

  // Backtest -> strategy / assets / equity curve / trades
  for (const { item: b, prefix } of ctx.safeBacktests) {
    if (text(b.strategyId) && !ctx.strategyById.has(b.strategyId)) {
      ctx.issues.push({ path: `${prefix}.strategyId`, message: `Strategy "${b.strategyId}" does not exist.` });
    }
    const strategy = text(b.strategyId) ? ctx.strategyById.get(b.strategyId) : undefined;
    if (idList(b.assetIds)) {
      for (const assetId of b.assetIds) {
        if (!ctx.assetById.has(assetId)) {
          ctx.issues.push({ path: `${prefix}.assetIds`, message: `Asset "${assetId}" does not exist.` });
        } else if (strategy && idList(strategy.assetIds) && !strategy.assetIds.includes(assetId)) {
          ctx.issues.push({ path: `${prefix}.assetIds`, message: `Asset "${assetId}" is not declared by the strategy.` });
        }
      }
    }
    if (b.equityCurveId !== undefined && text(b.equityCurveId) && !ctx.equityCurveById.has(b.equityCurveId)) {
      ctx.issues.push({ path: `${prefix}.equityCurveId`, message: `EquityCurve "${b.equityCurveId}" does not exist.` });
    }
    if (idList(b.tradeLogIds)) {
      for (const tradeId of b.tradeLogIds) {
        const trade = ctx.tradeLogById.get(tradeId);
        if (!trade) {
          ctx.issues.push({ path: `${prefix}.tradeLogIds`, message: `TradeLog "${tradeId}" does not exist.` });
          continue;
        }
        if (text(trade.backtestId) && trade.backtestId !== b.id) ctx.issues.push({ path: `${prefix}.tradeLogIds`, message: `TradeLog "${tradeId}" belongs to a different backtest.` });
        if (text(trade.strategyId) && text(b.strategyId) && trade.strategyId !== b.strategyId) ctx.issues.push({ path: `${prefix}.tradeLogIds`, message: `TradeLog "${tradeId}" belongs to a different strategy.` });
        if (text(trade.assetId) && idList(b.assetIds) && !b.assetIds.includes(trade.assetId)) ctx.issues.push({ path: `${prefix}.tradeLogIds`, message: `TradeLog "${tradeId}" asset is not in backtest.assetIds.` });
      }
    }
  }

  // EquityCurve -> strategy / backtest (bidirectional back-reference)
  for (const { item: c, prefix } of ctx.safeEquityCurves) {
    if (text(c.strategyId) && !ctx.strategyById.has(c.strategyId)) {
      ctx.issues.push({ path: `${prefix}.strategyId`, message: `Strategy "${c.strategyId}" does not exist.` });
    }
    if (text(c.backtestId) && !ctx.backtestById.has(c.backtestId)) {
      ctx.issues.push({ path: `${prefix}.backtestId`, message: `Backtest "${c.backtestId}" does not exist.` });
    }
    const backtest = text(c.backtestId) ? ctx.backtestById.get(c.backtestId) : undefined;
    if (backtest) {
      if (text(c.strategyId) && text(backtest.strategyId) && backtest.strategyId !== c.strategyId) {
        ctx.issues.push({ path: `${prefix}.strategyId`, message: 'Curve strategy must match the backtest strategy.' });
      }
      const backRef = backtest.equityCurveId;
      if ((backRef === undefined || text(backRef)) && backRef !== c.id) {
        ctx.issues.push({ path: `${prefix}.backtestId`, message: 'Backtest must reference this curve back via equityCurveId.' });
      }
    }
  }

  // TradeLog -> strategy / backtest / asset (bidirectional)
  for (const { item: t, prefix } of ctx.safeTradeLogs) {
    if (text(t.strategyId) && !ctx.strategyById.has(t.strategyId)) {
      ctx.issues.push({ path: `${prefix}.strategyId`, message: `Strategy "${t.strategyId}" does not exist.` });
    }
    if (text(t.backtestId) && !ctx.backtestById.has(t.backtestId)) {
      ctx.issues.push({ path: `${prefix}.backtestId`, message: `Backtest "${t.backtestId}" does not exist.` });
    }
    if (text(t.assetId) && !ctx.assetById.has(t.assetId)) {
      ctx.issues.push({ path: `${prefix}.assetId`, message: `Asset "${t.assetId}" does not exist.` });
    }
    const backtest = text(t.backtestId) ? ctx.backtestById.get(t.backtestId) : undefined;
    const strategy = text(t.strategyId) ? ctx.strategyById.get(t.strategyId) : undefined;
    if (backtest) {
      if (text(t.strategyId) && text(backtest.strategyId) && backtest.strategyId !== t.strategyId) {
        ctx.issues.push({ path: `${prefix}.strategyId`, message: 'Trade strategy must match the backtest strategy.' });
      }
      if (text(t.assetId) && idList(backtest.assetIds) && !backtest.assetIds.includes(t.assetId)) {
        ctx.issues.push({ path: `${prefix}.assetId`, message: 'Trade asset must be included in backtest.assetIds.' });
      }
      if (text(t.id) && idList(backtest.tradeLogIds) && !backtest.tradeLogIds.includes(t.id)) {
        ctx.issues.push({ path: `${prefix}.id`, message: 'Backtest must include this trade in tradeLogIds.' });
      }
    }
    if (strategy) {
      if (text(t.assetId) && idList(strategy.assetIds) && !strategy.assetIds.includes(t.assetId)) {
        ctx.issues.push({ path: `${prefix}.assetId`, message: 'Trade asset must be included in strategy.assetIds.' });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function validateDataset(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: '', message: 'Dataset must be a JSON object.' }];
  }

  const ctx = newCtx();

  if (input.modelVersion !== MODEL_VERSION) {
    ctx.issues.push({ path: 'modelVersion', message: `Expected modelVersion "${MODEL_VERSION}".` });
  }

  for (const key of ROOT_KEYS) {
    if (!Array.isArray(input[key])) {
      ctx.issues.push({ path: key, message: 'Expected an array.' });
    }
  }

  eachEntity('strategies', input.strategies, ctx.issues, (item, index) => validateStrategy(ctx, item, index));
  eachEntity('assets', input.assets, ctx.issues, (item, index) => validateAsset(ctx, item, index));
  eachEntity('backtests', input.backtests, ctx.issues, (item, index) => validateBacktest(ctx, item, index));
  eachEntity('equityCurves', input.equityCurves, ctx.issues, (item, index) => validateEquityCurve(ctx, item, index));
  eachEntity('tradeLogs', input.tradeLogs, ctx.issues, (item, index) => validateTradeLog(ctx, item, index));

  validateReferences(ctx);

  return ctx.issues;
}
