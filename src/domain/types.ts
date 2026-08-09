/** Versioned Phase 2A domain contracts. These describe imported evidence only; they do not generate strategies. */
export const DATA_MODEL_VERSION = '1.0' as const;
export type DataStatus = 'mock' | 'real';
export type Currency = string;

export type Provenance = {
  dataStatus: DataStatus;
  sourceName: string;
  sourceType: 'fixture' | 'owner-delivery' | 'broker-export' | 'other';
  receivedAt?: string;
  sourceFile?: string;
  notes?: string;
};

export type Asset = {
  id: string;
  symbol: string;
  name: string;
  assetClass: 'crypto' | 'equity' | 'forex' | 'future' | 'other';
  exchange?: string;
  quoteCurrency?: Currency;
};

export type Strategy = {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: 'active' | 'archived' | 'draft';
  assetIds: string[];
  provenance: Provenance;
  backtestIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type EquityPoint = {
  timestamp: string;
  equity: number;
  drawdown?: number;
  balance?: number;
};
export type EquityCurve = {
  id: string;
  strategyId: string;
  backtestId: string;
  currency: Currency;
  points: EquityPoint[];
  provenance: Provenance;
};

export type Metrics = {
  totalReturn?: number;
  annualizedReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  winRate?: number;
  tradeCount?: number;
  profitFactor?: number;
  [key: string]: number | undefined;
};

export type BacktestResult = {
  id: string;
  strategyId: string;
  assetIds: string[];
  startedAt: string;
  endedAt: string;
  timeframe: string;
  initialCapital: number;
  currency: Currency;
  metrics: Metrics;
  equityCurveId?: string;
  tradeLogIds: string[];
  provenance: Provenance;
};

export type TradeLog = {
  id: string;
  backtestId: string;
  strategyId: string;
  assetId: string;
  side: 'buy' | 'sell';
  openedAt: string;
  closedAt?: string;
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  fees?: number;
  pnl?: number;
  currency: Currency;
  provenance: Provenance;
};

export type QuantoraDataset = {
  modelVersion: typeof DATA_MODEL_VERSION;
  strategies: Strategy[];
  assets: Asset[];
  backtests: BacktestResult[];
  equityCurves: EquityCurve[];
  tradeLogs: TradeLog[];
};
