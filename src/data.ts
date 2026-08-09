export type Asset = 'BTC' | 'ETH' | 'SPY' | 'NASDAQ';

export type TradeSide = 'BUY' | 'SELL' | 'HOLD';

export type Trade = {
  date: string;
  asset: Asset;
  side: TradeSide;
  pnl: string; // demo P&L, clearly mock
};

export type Strategy = {
  id: string;
  name: string;
  tagline: string;
  assets: Asset[];
  type: string;
  returnPct: number;
  risk: string;
  maxDrawdown: string;
  sharpe: string;
  winRate: string;
  trades: string;
  fee: string;
  color: string;
  curve: number[];
  curveByAsset?: Partial<Record<Asset, number[]>>;
  log: Trade[];
  description: string;
};

export const strategies: Strategy[] = [
  {
    id: 'atlas-btc',
    name: 'Atlas BTC Momentum',
    tagline: 'Trend-following for crypto cycles',
    assets: ['BTC'],
    type: 'Momentum',
    returnPct: 38.4,
    risk: 'Medium',
    maxDrawdown: '-16.2%',
    sharpe: '1.42',
    winRate: '58%',
    trades: '184',
    fee: '1.2%',
    color: '#c9ff5a',
    curve: [20, 23, 22, 28, 31, 30, 38, 42, 40, 48, 53, 51, 61, 68, 66, 77, 84, 82, 92, 100],
    log: [
      { date: '2025-02-14', asset: 'BTC', side: 'SELL', pnl: '+3.1%' },
      { date: '2025-01-30', asset: 'BTC', side: 'BUY', pnl: '+2.4%' },
      { date: '2025-01-22', asset: 'BTC', side: 'BUY', pnl: '+1.8%' },
      { date: '2025-01-08', asset: 'BTC', side: 'HOLD', pnl: '+0.6%' },
      { date: '2024-12-19', asset: 'BTC', side: 'SELL', pnl: '-2.1%' },
      { date: '2024-12-09', asset: 'BTC', side: 'BUY', pnl: '+4.2%' },
      { date: '2024-11-27', asset: 'BTC', side: 'BUY', pnl: '+2.9%' },
      { date: '2024-11-18', asset: 'BTC', side: 'SELL', pnl: '+5.4%' },
    ],
    description:
      'A systematic momentum model designed to participate in sustained Bitcoin trends while managing downside with adaptive exits.',
  },
  {
    id: 'northstar-multi',
    name: 'Northstar Multi-Asset',
    tagline: 'One model. Four liquid markets.',
    assets: ['BTC', 'ETH', 'SPY', 'NASDAQ'],
    type: 'Multi-asset',
    returnPct: 24.7,
    risk: 'Low',
    maxDrawdown: '-8.4%',
    sharpe: '1.68',
    winRate: '62%',
    trades: '312',
    fee: '1.0%',
    color: '#72d9ff',
    curve: [20, 22, 24, 23, 27, 29, 31, 30, 35, 38, 40, 44, 43, 49, 53, 57, 60, 66, 70, 75],
    curveByAsset: {
      // Simulated, distinct indices per market so the selector visibly changes the curve.
      BTC: [20, 23, 21, 27, 30, 29, 36, 40, 38, 46, 51, 49, 58, 64, 62, 72, 79, 77, 88, 96],
      ETH: [20, 24, 22, 28, 33, 31, 39, 43, 41, 47, 54, 52, 60, 66, 70, 74, 72, 81, 87, 93],
      SPY: [20, 21, 23, 24, 26, 28, 29, 31, 33, 35, 37, 39, 41, 44, 46, 49, 52, 55, 58, 61],
      NASDAQ: [20, 22, 25, 24, 28, 31, 33, 36, 39, 41, 44, 47, 50, 53, 57, 60, 64, 68, 72, 76],
    },
    log: [
      { date: '2025-02-12', asset: 'SPY', side: 'BUY', pnl: '+1.2%' },
      { date: '2025-02-03', asset: 'NASDAQ', side: 'BUY', pnl: '+2.0%' },
      { date: '2025-01-27', asset: 'BTC', side: 'SELL', pnl: '+3.4%' },
      { date: '2025-01-15', asset: 'ETH', side: 'BUY', pnl: '-1.3%' },
      { date: '2025-01-06', asset: 'SPY', side: 'HOLD', pnl: '+0.5%' },
      { date: '2024-12-20', asset: 'NASDAQ', side: 'SELL', pnl: '+2.2%' },
      { date: '2024-12-11', asset: 'BTC', side: 'BUY', pnl: '+1.9%' },
      { date: '2024-11-28', asset: 'ETH', side: 'BUY', pnl: '+2.6%' },
    ],
    description:
      "Diversified signals across crypto and equities, balancing exposure with a volatility-aware allocation engine.",
  },
  {
    id: 'vector-eth',
    name: 'Vector ETH Rotation',
    tagline: 'Rules-based rotation, no guesswork',
    assets: ['ETH'],
    type: 'Rotation',
    returnPct: 31.2,
    risk: 'High',
    maxDrawdown: '-22.8%',
    sharpe: '1.21',
    winRate: '55%',
    trades: '226',
    fee: '1.4%',
    color: '#b79cff',
    curve: [20, 25, 22, 29, 33, 30, 39, 37, 48, 46, 57, 55, 63, 60, 72, 76, 72, 84, 88, 95],
    log: [
      { date: '2025-02-11', asset: 'ETH', side: 'SELL', pnl: '+2.7%' },
      { date: '2025-01-29', asset: 'ETH', side: 'BUY', pnl: '-1.6%' },
      { date: '2025-01-16', asset: 'ETH', side: 'BUY', pnl: '+4.1%' },
      { date: '2025-01-05', asset: 'ETH', side: 'HOLD', pnl: '+0.8%' },
      { date: '2024-12-22', asset: 'ETH', side: 'SELL', pnl: '+3.3%' },
      { date: '2024-12-10', asset: 'ETH', side: 'BUY', pnl: '+2.2%' },
      { date: '2024-11-30', asset: 'ETH', side: 'BUY', pnl: '-2.4%' },
      { date: '2024-11-19', asset: 'ETH', side: 'SELL', pnl: '+5.1%' },
    ],
    description:
      'A fast-moving rotation system for Ethereum, seeking relative strength across market regimes.',
  },
  {
    id: 'signal-spy',
    name: 'Signal SPY Defensive',
    tagline: 'Steady exposure for patient allocators',
    assets: ['SPY'],
    type: 'Trend',
    returnPct: 15.8,
    risk: 'Low',
    maxDrawdown: '-6.1%',
    sharpe: '1.55',
    winRate: '64%',
    trades: '96',
    fee: '0.8%',
    color: '#ffb86b',
    curve: [20, 22, 24, 25, 27, 29, 28, 32, 34, 37, 39, 42, 43, 47, 50, 54, 57, 59, 63, 68],
    log: [
      { date: '2025-02-10', asset: 'SPY', side: 'BUY', pnl: '+1.1%' },
      { date: '2025-01-28', asset: 'SPY', side: 'HOLD', pnl: '+0.4%' },
      { date: '2025-01-14', asset: 'SPY', side: 'SELL', pnl: '+0.9%' },
      { date: '2025-01-02', asset: 'SPY', side: 'BUY', pnl: '+1.3%' },
      { date: '2024-12-18', asset: 'SPY', side: 'BUY', pnl: '+0.7%' },
      { date: '2024-12-04', asset: 'SPY', side: 'SELL', pnl: '-0.6%' },
      { date: '2024-11-21', asset: 'SPY', side: 'BUY', pnl: '+1.5%' },
      { date: '2024-11-07', asset: 'SPY', side: 'BUY', pnl: '+1.0%' },
    ],
    description:
      'A measured equity strategy that favors capital preservation and smooth participation over high turnover.',
  },
];

export const findStrategy = (id: string): Strategy | undefined =>
  strategies.find((s) => s.id === id);

/** Curve for a given asset: single-asset strategies reuse their main curve. */
export function curveFor(s: Strategy, asset: Asset): number[] {
  return s.curveByAsset?.[asset] ?? s.curve;
}

// ---------------------------------------------------------------------------
// Dashboard mock data (Phase 1 preview only — no real licenses, files or history).
// ---------------------------------------------------------------------------
export type LicenseStatus = 'Active' | 'Trial' | 'Expired';

export type DashboardLicense = {
  id: string;
  strategyId: string;
  strategyName: string;
  type: 'Rental' | 'Full';
  status: LicenseStatus;
  expires: string;
};

export type DashboardDownload = {
  id: string;
  name: string;
  format: string;
  size: string;
  date: string;
};

export type DashboardActivity = {
  id: string;
  label: string;
  detail: string;
  date: string;
};

export const licenses: DashboardLicense[] = [
  { id: 'lic-001', strategyId: 'atlas-btc', strategyName: 'Atlas BTC Momentum', type: 'Rental', status: 'Active', expires: '2026-03-01' },
  { id: 'lic-002', strategyId: 'northstar-multi', strategyName: 'Northstar Multi-Asset', type: 'Full', status: 'Trial', expires: '2025-09-01' },
  { id: 'lic-003', strategyId: 'vector-eth', strategyName: 'Vector ETH Rotation', type: 'Rental', status: 'Expired', expires: '2025-01-15' },
];

export const downloads: DashboardDownload[] = [
  { id: 'dl-001', name: 'atlas-btc-equity.csv', format: 'CSV', size: '148 KB', date: '2025-02-18' },
  { id: 'dl-002', name: 'northstar-multi-trades.csv', format: 'CSV', size: '212 KB', date: '2025-02-11' },
  { id: 'dl-003', name: 'quantora-brochure.pdf', format: 'PDF', size: '1.2 MB', date: '2025-01-30' },
];

export const activity: DashboardActivity[] = [
  { id: 'act-001', label: 'License activated', detail: 'Atlas BTC Momentum · Rental', date: '2025-02-18' },
  { id: 'act-002', label: 'Dataset exported', detail: 'northstar-multi-trades.csv', date: '2025-02-11' },
  { id: 'act-003', label: 'Trial started', detail: 'Northstar Multi-Asset · Full', date: '2025-02-02' },
  { id: 'act-004', label: 'License expired', detail: 'Vector ETH Rotation · Rental', date: '2025-01-15' },
];