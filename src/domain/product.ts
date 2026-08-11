/**
 * Quantora product catalog — Phase 1 presentation model.
 *
 * This module is the single source of truth for what the UI renders about a
 * strategy. It sits ON TOP of the Phase 2A evidence contracts (`./types`) and
 * keeps the split honest:
 *   - `metrics` / `evidence` / `dataBehindScore`  → owner-provided figures ONLY.
 *   - `dimensions`, `riskLevel`, `experienceLevel`, `frequency`,
 *     `marketContext`, `suitableFor`, `notSuitableFor`, `fitsYou` →
 *     Quantora's own qualitative assessment model, explicitly labeled as such.
 *
 * No result is invented here: the two real profiles carry exactly the metrics
 * supplied by the owner; the four mock profiles are legacy Phase 1 fixtures
 * and are always labeled MOCK.
 */

/** Owner-provided metrics only (extensible: add optional fields as the owner delivers more). */
export type StrategyMetrics = {
  powerScore: number;
  profitFactor?: number;
  tradeCount?: number;
  netProfitUsd?: number;
  avgProfitPerTradeUsd?: number;
  maxDrawdownUsd?: number;
  maxDrawdownPct?: number;
  periodStart?: string;
  periodEnd?: string;
  ticksProcessed?: number;
  /** Legacy mock-only fields (Phase 1 fixtures). */
  demoReturnPct?: number;
  sharpeRatio?: number;
  winRatePct?: number;
};

export type RiskLevel = 'low' | 'medium' | 'high';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TradeFrequency = 'low' | 'medium' | 'high';
export type MarketContext = 'trend' | 'range' | 'volatile' | 'multi';
export type DataStatus = 'real' | 'mock';

export const POWER_SCORE_MAX = 10;

/**
 * The mandatory Power Score explanation. This text is rendered verbatim on the
 * catalog, the detail pages and the comparison page. It is intentionally
 * non-promissory: a score is an assessment of available evidence, never a
 * prediction of future results.
 */
export const POWER_SCORE_EXPLANATION =
  'The Power Score is Quantora\u2019s indicative rating from 1 to 10 of a strategy\u2019s quality as perceived from the available evidence. It combines six weighted dimensions \u2014 returns, consistency, risk management, methodological robustness, execution, and data quality \u2014 so the total can be audited. A higher score means the evidence available looks stronger; it is NOT a prediction of future results, a guarantee of performance, or investment advice.';

/** Six weighted dimensions of the Power Score (weights sum to 1). */
export type ScoreDimension = {
  id: string;
  label: string;
  score: number; // 1–10
  weight: number; // 0–1
  why: string;
};

export const DIMENSION_WEIGHTS: { id: string; label: string; weight: number }[] = [
  { id: 'returns', label: 'Returns', weight: 0.25 },
  { id: 'risk', label: 'Risk management', weight: 0.2 },
  { id: 'data', label: 'Data quality', weight: 0.15 },
  { id: 'consistency', label: 'Consistency', weight: 0.15 },
  { id: 'robustness', label: 'Methodological robustness', weight: 0.15 },
  { id: 'execution', label: 'Execution', weight: 0.1 },
];

export type StrategyProfile = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  dataStatus: DataStatus;
  /** Human label shown as badge, e.g. "Owner-provided data" or "Mock demo". */
  sourceLabel: string;
  /** Symbols; empty when the owner has not disclosed the market. */
  assets: string[];
  marketContext: MarketContext;
  riskLevel: RiskLevel;
  experienceLevel: ExperienceLevel;
  frequency: TradeFrequency;
  metrics: StrategyMetrics;
  dimensions: ScoreDimension[];
  howItWorks: string[];
  suitableFor: string[];
  notSuitableFor: string[];
  fitsYou: { label: string; detail: string }[];
  /** The exact owner figures behind the score, label + formatted value. */
  dataBehindScore: { label: string; value: string }[];
  methodology: string[];
  limitations: string[];
  /** What was provided and by whom. */
  evidence: { label: string; detail: string }[];
  color: string;
  /** Mock-only illustrative curve; real profiles have none (never invented). */
  curve?: number[];
  updatedAt: string;
  /** V2B — owner-supplied positioning line (e.g. "Specialist in sideways markets"). */
  positioning?: string;
  /** V2B — structural vs. economic outcome facts (WIN/LOSS rules, counts). */
  structuralFacts?: {
    winCount: number;
    lossCount: number;
    winRule: string;
    lossRule: string;
    stopPoints?: number;
  };
  /** V2B — allowed/excluded trading hours (owner-supplied, timezone-labeled). */
  scheduleFacts?: {
    timezone: string;
    allowed: { start: string; end: string }[];
    excluded: { start: string; end: string }[];
  };
  /** V2B — honest note when per-trade series are pending delivery. */
  datasetStatusNote?: string;
  /** V2B — discrete evidence source label (e.g. "Owner Supplied"). */
  evidenceSource?: string;
};

/** Deterministic mock decomposition so legacy demo scores look consistent. */
function mockDimensions(overall: number): ScoreDimension[] {
  const base = overall * 0.94;
  const spreads = [0.4, -0.3, 0.2, 0.1, -0.2, 0.3];
  const scores = spreads.map((s) => Math.min(10, Math.max(1, Math.round((base + s) * 10) / 10)));
  const dims = DIMENSION_WEIGHTS.map((d, i) => ({
    id: d.id,
    label: d.label,
    score: scores[i]!,
    weight: d.weight,
    why: 'Mock demo dimension — illustrative decomposition of the demo score.',
  }));
  // Calibrate 'returns' so the weighted sum matches the declared demo score.
  const fixed = dims.filter((d) => d.id !== 'returns');
  const fixedSum = fixed.reduce((acc, d) => acc + d.score * d.weight, 0);
  const returns = Math.min(10, Math.max(1, Math.round(((overall - fixedSum) / 0.25) * 10) / 10));
  return dims.map((d) => (d.id === 'returns' ? { ...d, score: returns } : d));
}

function weightedSum(dimensions: ScoreDimension[]): number {
  return dimensions.reduce((acc, d) => acc + d.score * d.weight, 0);
}

const METHODOLOGY_SHARED = [
  'Each dimension is scored 1–10 by Quantora from the available evidence and documented here so the total can be audited.',
  'The Power Score is the weighted sum of the six dimensions, rounded to one decimal.',
  'The qualitative profile (risk, experience, frequency, context) is Quantora\u2019s assessment model, not owner data.',
];

const LIMITATION_SHARED = [
  'Only summary metrics were provided for this strategy \u2014 the equity curve and trade log are still pending delivery, so curve shape, losing streaks and drawdown timing cannot be validated yet.',
  'Historical results, as provided by the owner, are not a guarantee of future performance.',
  'Backtests can contain biases that are invisible in summary statistics.',
];

/**
 * Build a score decomposition from explicitly declared per-dimension scores.
 * The declared scores are Quantora's indicative decomposition of the
 * owner-provided Power Score — the weighted sum is validated to match it.
 */
function realDimensions(
  overall: number,
  dims: { id: string; score: number; why: string }[],
): ScoreDimension[] {
  const byId = new Map(dims.map((d) => [d.id, d]));
  const result = DIMENSION_WEIGHTS.map((d) => {
    const declared = byId.get(d.id);
    if (!declared) throw new Error(`Missing dimension score for ${d.id}`);
    return { id: d.id, label: d.label, weight: d.weight, score: declared.score, why: declared.why };
  });
  const total = result.reduce((acc, d) => acc + d.score * d.weight, 0);
  if (Math.abs(total - overall) > 0.06) {
    throw new Error(`Dimension weights for overall ${overall} sum to ${total.toFixed(2)}`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------------

export const profiles: StrategyProfile[] = [
  // ---- Owner-provided (real) -------------------------------------------------
  {
    id: 'first-triangle-adaptive',
    name: 'First Triangle Adaptive',
    tagline: 'Adaptive triangle breakout trading with capped risk',
    description:
      'A rules-based strategy that detects triangle consolidation patterns, waits for a confirmed breakout and trades it in the direction of the prevailing trend. Position size adapts to market conditions and every operation follows the same entry, stop and exit rules. All figures shown come from the owner\u2019s delivery.',
    dataStatus: 'real',
    sourceLabel: 'Owner-provided data',
    evidenceSource: 'Owner Supplied',
    assets: [],
    marketContext: 'multi',
    riskLevel: 'medium',
    experienceLevel: 'beginner',
    frequency: 'low',
    datasetStatusNote:
      'Per-trade series have not been delivered yet. Aggregate metrics are owner-supplied and shown verbatim; the equity curve is not invented and will populate when the series arrive.',
    metrics: {
      powerScore: 7.2,
      profitFactor: 1.2559,
      tradeCount: 145,
      netProfitUsd: 6687.5,
      avgProfitPerTradeUsd: 46.12,
      maxDrawdownUsd: 4474.8,
    },
    dimensions: realDimensions(7.2, [
      { id: 'returns', score: 8.0, why: 'Solid net result (+6,687.50 USD) with a high average per operation (+46.12 USD).' },
      { id: 'risk', score: 6.5, why: 'Drawdown is controlled in absolute terms but not negligible (4,474.80 USD).' },
      { id: 'data', score: 7.0, why: 'Owner-provided summary metrics; equity curve and trade log still pending.' },
      { id: 'consistency', score: 7.0, why: 'Positive average per operation across a modest 145-operation sample.' },
      { id: 'robustness', score: 7.0, why: 'Adaptive rules suggest regime awareness; small sample limits confidence.' },
      { id: 'execution', score: 7.0, why: 'Low frequency and a simple rule set keep operational complexity low.' },
    ]),
    howItWorks: [
      'Detects classic triangle patterns (ascending, descending, symmetrical) on the active chart.',
      'Waits for a confirmed breakout — price must close beyond the pattern boundary.',
      'Enters in the breakout direction with a pre-defined stop and target.',
      'Adapts position size and filters to current volatility and trend context.',
      'Exits at target, stop or reversal signal. No discretionary changes mid-trade.',
    ],
    suitableFor: [
      'Traders who can follow a fixed system without changing the rules mid-trade.',
      'Accounts that accept a moderate drawdown in exchange for capped-risk exposure.',
      'People who can wait for quality setups instead of forcing trades.',
    ],
    notSuitableFor: [
      'Traders expecting very high frequency or daily returns.',
      'Accounts that cannot tolerate an equity drawdown around USD 4,474.80.',
      'Anyone expecting guaranteed results — no strategy can promise those.',
    ],
    fitsYou: [
      { label: 'Risk tolerance', detail: 'Medium — historical max drawdown \u2248 USD 4,474.80.' },
      { label: 'Experience', detail: 'Accessible to beginners who follow rules; useful for intermediate traders.' },
      { label: 'Time commitment', detail: 'Low to moderate — 145 operations in the provided sample.' },
    ],
    dataBehindScore: [
      { label: 'Power Score', value: '7.2 / 10' },
      { label: 'Profit factor', value: '1.2559' },
      { label: 'Operations', value: '145' },
      { label: 'Net result', value: '+6,687.50 USD' },
      { label: 'Average per operation', value: '+46.12 USD' },
      { label: 'Max drawdown', value: '4,474.80 USD' },
    ],
    methodology: METHODOLOGY_SHARED,
    limitations: [
      ...LIMITATION_SHARED,
      'The 145-operation sample is small; statistical confidence is limited.',
    ],
    evidence: [
      { label: 'Power Score', detail: '7.2 — provided by the owner' },
      { label: 'Profit factor', detail: '1.2559 — provided by the owner' },
      { label: 'Operations', detail: '145 — provided by the owner' },
      { label: 'Net result', detail: '+6,687.50 USD — provided by the owner' },
      { label: 'Average per operation', detail: '+46.12 USD — provided by the owner' },
      { label: 'Max drawdown', detail: '4,474.80 USD — provided by the owner' },
    ],
    color: '#c9ff5a',
    updatedAt: '2026-08-09',
  },
  {
    id: 'stochextreme-adaptive',
    name: 'StochExtreme Adaptive',
    tagline: 'Specialist in sideways markets',
    description:
      'A stochastic mean-reversion system specialized in sideways markets. It trades extreme overbought and oversold zones on USTEC, adapting its thresholds to recent volatility and respecting a strict intraday session filter. Structural outcome (WIN/LOSS by rule) is tracked separately from economic result (post-cost P&L), because a structural WIN can still close negative after execution costs. All figures shown come from the owner\u2019s delivery.',
    dataStatus: 'real',
    sourceLabel: 'Owner-provided data',
    evidenceSource: 'Owner Supplied',
    assets: ['USTEC'],
    marketContext: 'range',
    riskLevel: 'high',
    experienceLevel: 'advanced',
    frequency: 'high',
    positioning: 'Specialist in sideways markets',
    structuralFacts: {
      winCount: 200,
      lossCount: 221,
      winRule: 'BUY counts as a structural WIN only when K \u2265 80; SELL counts as a structural WIN only when K \u2264 20.',
      lossRule: 'A structural LOSS is recorded only on a definitive stop touch (USTEC, 100 points).',
      stopPoints: 100,
    },
    scheduleFacts: {
      timezone: 'ET',
      allowed: [
        { start: '03:00', end: '11:30' },
        { start: '14:00', end: '18:00' },
      ],
      excluded: [
        { start: '11:30', end: '14:00' },
        { start: '18:00', end: '03:00' },
      ],
    },
    datasetStatusNote:
      'Pending dataset delivery: trades.csv, equity.csv, manifest.csv, coverage.csv, strategy_config.csv, events.csv and symbol_specifications.csv are not present in the repository. Aggregate metrics are owner-supplied and shown verbatim; the equity curve, drawdown, monthly heatmap and trade log will populate when the per-trade series arrive.',
    metrics: {
      powerScore: 6.1,
      profitFactor: 1.1514,
      tradeCount: 421,
      netProfitUsd: 6582,
      maxDrawdownPct: 26.53,
      maxDrawdownUsd: 4690,
      periodStart: '2025-08-01',
      periodEnd: '2026-08-07',
      ticksProcessed: 509489041,
    },
    dimensions: realDimensions(6.1, [
      { id: 'returns', score: 6.5, why: 'Positive net result (+6,582 USD) but a thin average edge spread over 421 operations.' },
      { id: 'risk', score: 5.5, why: 'Large historical drawdown (26.53% / USD 4,690) weighs heavily on the score.' },
      { id: 'data', score: 6.5, why: 'Rich tick evidence (509,489,041 ticks) but no equity curve or trade log yet.' },
      { id: 'consistency', score: 6.0, why: 'Profit factor 1.1514 is modest; high turnover implies many losing runs are possible.' },
      { id: 'robustness', score: 6.0, why: 'Adaptive thresholds help across regimes; overfitting cannot be ruled out from summaries.' },
      { id: 'execution', score: 6.0, why: 'High turnover increases execution costs and operational complexity.' },
    ]),
    howItWorks: [
      'Tracks the stochastic oscillator (K) and flags extreme overbought/oversold zones on USTEC.',
      'Adapts the extreme thresholds to recent volatility so signals stay relevant in sideways conditions.',
      'A BUY counts as a structural WIN only when K \u2265 80; a SELL counts as a structural WIN only when K \u2264 20.',
      'A structural LOSS is recorded only on a definitive stop touch (USTEC, 100 points) \u2014 separate from the economic result after execution costs.',
      'Trades only inside the allowed ET sessions (03:00\u201311:30 and 14:00\u201318:00); no trades 11:30\u201314:00 or 18:00\u201303:00.',
      '421 operations in the provided sample (v1.07 filtered, 01/08/2025 \u2013 07/08/2026).',
    ],
    suitableFor: [
      'Traders comfortable with frequent operations and screen time.',
      'Accounts that tolerate drawdowns above 26% (the historical maximum).',
      'Users who want a large sample of operations to judge behavior quickly.',
    ],
    notSuitableFor: [
      'Beginners \u2014 the risk profile is high and drawdowns are large.',
      'Accounts that cannot absorb a 26.53% historical drawdown.',
      'Anyone expecting smooth equity \u2014 this system has sharp drawdown phases.',
      'Trend-following or breakout-seeking traders \u2014 this is a sideways-market specialist.',
    ],
    fitsYou: [
      { label: 'Positioning', detail: 'Specialist in sideways markets \u2014 best in range-bound USTEC sessions.' },
      { label: 'Risk tolerance', detail: 'High \u2014 historical max drawdown 26.53% / USD 4,690.' },
      { label: 'Experience', detail: 'Advanced \u2014 requires discipline under large drawdowns.' },
      { label: 'Time commitment', detail: 'High \u2014 \u2248 421 operations in the sample period (01/08/2025 \u2013 07/08/2026).' },
    ],
    dataBehindScore: [
      { label: 'Power Score', value: '6.1 / 10' },
      { label: 'Profit factor', value: '1.1514' },
      { label: 'Operations', value: '421' },
      { label: 'Net result', value: '+6,582 USD' },
      { label: 'Max drawdown', value: '26.53% / 4,690 USD' },
      { label: 'Structural WIN / LOSS', value: '200 / 221' },
      { label: 'Sample period', value: '01/08/2025 \u2013 07/08/2026' },
      { label: 'Ticks processed', value: '509,489,041' },
    ],
    methodology: METHODOLOGY_SHARED,
    limitations: [
      ...LIMITATION_SHARED,
      'A 26.53% drawdown means the strategy is aggressive: a large part of the profit can be given back in adverse phases.',
      'Structural WIN/LOSS (200/221) is separate from economic result: a structural WIN can still lose money after costs.',
    ],
    evidence: [
      { label: 'Power Score', detail: '6.1 \u2014 provided by the owner' },
      { label: 'Profit factor', detail: '1.1514 \u2014 provided by the owner' },
      { label: 'Operations', detail: '421 \u2014 provided by the owner' },
      { label: 'Net result', detail: '+6,582 USD \u2014 provided by the owner' },
      { label: 'Max drawdown', detail: '26.53% / 4,690 USD \u2014 provided by the owner' },
      { label: 'Structural WIN / LOSS', detail: '200 / 221 \u2014 provided by the owner' },
      { label: 'Sample period', detail: '01/08/2025 \u2013 07/08/2026 \u2014 provided by the owner' },
      { label: 'Ticks processed', detail: '509,489,041 \u2014 provided by the owner' },
      { label: 'Version', detail: 'v1.07 filtered \u2014 provided by the owner' },
      { label: 'Per-trade series', detail: 'Pending delivery (trades.csv, equity.csv, manifest.csv, coverage.csv, strategy_config.csv, events.csv, symbol_specifications.csv)' },
    ],
    color: '#ffb86b',
    updatedAt: '2026-08-09',
  },

  // ---- Legacy mock fixtures (Phase 1) ----------------------------------------
  {
    id: 'atlas-btc',
    name: 'Atlas BTC Momentum',
    tagline: 'Trend-following for crypto cycles',
    description:
      'A systematic momentum model designed to participate in sustained Bitcoin trends while managing downside with adaptive exits. MOCK DEMO — all figures are simulated.',
    dataStatus: 'mock',
    sourceLabel: 'Mock demo',
    assets: ['BTC'],
    marketContext: 'trend',
    riskLevel: 'medium',
    experienceLevel: 'intermediate',
    frequency: 'medium',
    metrics: {
      powerScore: 6.8,
      demoReturnPct: 38.4,
      sharpeRatio: 1.42,
      winRatePct: 58,
      tradeCount: 184,
      maxDrawdownUsd: undefined,
    },
    dimensions: mockDimensions(6.8),
    howItWorks: [
      'Tracks sustained Bitcoin trends with a momentum filter.',
      'Adds adaptive exits that tighten as trends mature.',
      'Stays in the market while the trend is healthy, exits on reversal.',
    ],
    suitableFor: ['Crypto traders who can accept volatility.', 'Users who understand trend-following lag.'],
    notSuitableFor: ['Range-bound markets with no clear trend.', 'Risk-averse accounts.'],
    fitsYou: [
      { label: 'Risk tolerance', detail: 'Medium — crypto volatility.' },
      { label: 'Experience', detail: 'Intermediate.' },
      { label: 'Time commitment', detail: 'Medium — 184 trades in demo data.' },
    ],
    dataBehindScore: [
      { label: 'Power Score', value: '6.8 / 10 (demo)' },
      { label: 'Demo return', value: '+38.4%' },
      { label: 'Sharpe (demo)', value: '1.42' },
      { label: 'Win rate (demo)', value: '58%' },
      { label: 'Trades (demo)', value: '184' },
    ],
    methodology: METHODOLOGY_SHARED,
    limitations: ['Entirely mock — simulated index, no real backtest evidence.'],
    evidence: [{ label: 'All metrics', detail: 'MOCK DEMO — simulated for product demonstration.' }],
    color: '#c9ff5a',
    curve: [20, 23, 22, 28, 31, 30, 38, 42, 40, 48, 53, 51, 61, 68, 66, 77, 84, 82, 92, 100],
    updatedAt: '2025-02-18',
  },
  {
    id: 'northstar-multi',
    name: 'Northstar Multi-Asset',
    tagline: 'One model. Four liquid markets.',
    description:
      'Diversified signals across crypto and equities, balancing exposure with a volatility-aware allocation engine. MOCK DEMO — all figures are simulated.',
    dataStatus: 'mock',
    sourceLabel: 'Mock demo',
    assets: ['BTC', 'ETH', 'SPY', 'NASDAQ'],
    marketContext: 'multi',
    riskLevel: 'low',
    experienceLevel: 'beginner',
    frequency: 'medium',
    metrics: {
      powerScore: 6.5,
      demoReturnPct: 24.7,
      sharpeRatio: 1.68,
      winRatePct: 62,
      tradeCount: 312,
    },
    dimensions: mockDimensions(6.5),
    howItWorks: [
      'Applies one signal model across four liquid markets.',
      'Allocates exposure with a volatility-aware engine.',
      'Diversification smooths the equity path.',
    ],
    suitableFor: ['Beginners looking for broad exposure.', 'Users who want diversification.'],
    notSuitableFor: ['Traders seeking concentrated bets.'],
    fitsYou: [
      { label: 'Risk tolerance', detail: 'Low — diversified.' },
      { label: 'Experience', detail: 'Beginner-friendly.' },
      { label: 'Time commitment', detail: 'Medium.' },
    ],
    dataBehindScore: [
      { label: 'Power Score', value: '6.5 / 10 (demo)' },
      { label: 'Demo return', value: '+24.7%' },
      { label: 'Sharpe (demo)', value: '1.68' },
      { label: 'Win rate (demo)', value: '62%' },
      { label: 'Trades (demo)', value: '312' },
    ],
    methodology: METHODOLOGY_SHARED,
    limitations: ['Entirely mock — simulated index, no real backtest evidence.'],
    evidence: [{ label: 'All metrics', detail: 'MOCK DEMO — simulated for product demonstration.' }],
    color: '#72d9ff',
    curve: [20, 22, 24, 23, 27, 29, 31, 30, 35, 38, 40, 44, 43, 49, 53, 57, 60, 66, 70, 75],
    updatedAt: '2025-02-11',
  },
  {
    id: 'vector-eth',
    name: 'Vector ETH Rotation',
    tagline: 'Rules-based rotation, no guesswork',
    description:
      'A fast-moving rotation system for Ethereum, seeking relative strength across market regimes. MOCK DEMO — all figures are simulated.',
    dataStatus: 'mock',
    sourceLabel: 'Mock demo',
    assets: ['ETH'],
    marketContext: 'trend',
    riskLevel: 'high',
    experienceLevel: 'advanced',
    frequency: 'high',
    metrics: {
      powerScore: 6.3,
      demoReturnPct: 31.2,
      sharpeRatio: 1.21,
      winRatePct: 55,
      tradeCount: 226,
    },
    dimensions: mockDimensions(6.3),
    howItWorks: [
      'Ranks Ethereum regimes by relative strength.',
      'Rotates exposure to the strongest regime.',
      'Fast exits to protect gains.',
    ],
    suitableFor: ['Advanced traders who understand momentum churn.', 'ETH-focused accounts.'],
    notSuitableFor: ['Beginners.', 'Low-tolerance accounts.'],
    fitsYou: [
      { label: 'Risk tolerance', detail: 'High.' },
      { label: 'Experience', detail: 'Advanced.' },
      { label: 'Time commitment', detail: 'High — 226 trades in demo data.' },
    ],
    dataBehindScore: [
      { label: 'Power Score', value: '6.3 / 10 (demo)' },
      { label: 'Demo return', value: '+31.2%' },
      { label: 'Sharpe (demo)', value: '1.21' },
      { label: 'Win rate (demo)', value: '55%' },
      { label: 'Trades (demo)', value: '226' },
    ],
    methodology: METHODOLOGY_SHARED,
    limitations: ['Entirely mock — simulated index, no real backtest evidence.'],
    evidence: [{ label: 'All metrics', detail: 'MOCK DEMO — simulated for product demonstration.' }],
    color: '#b79cff',
    curve: [20, 25, 22, 29, 33, 30, 39, 37, 48, 46, 57, 55, 63, 60, 72, 76, 72, 84, 88, 95],
    updatedAt: '2025-02-11',
  },
  {
    id: 'signal-spy',
    name: 'Signal SPY Defensive',
    tagline: 'Steady exposure for patient allocators',
    description:
      'A measured equity strategy that favors capital preservation and smooth participation over high turnover. MOCK DEMO — all figures are simulated.',
    dataStatus: 'mock',
    sourceLabel: 'Mock demo',
    assets: ['SPY'],
    marketContext: 'range',
    riskLevel: 'low',
    experienceLevel: 'beginner',
    frequency: 'low',
    metrics: {
      powerScore: 6.9,
      demoReturnPct: 15.8,
      sharpeRatio: 1.55,
      winRatePct: 64,
      tradeCount: 96,
    },
    dimensions: mockDimensions(6.9),
    howItWorks: [
      'Measures trend health before committing capital.',
      'Keeps exposure steady through calm phases.',
      'Defensive exits when volatility rises.',
    ],
    suitableFor: ['Patient allocators.', 'Beginners.'],
    notSuitableFor: ['Traders seeking aggressive growth.'],
    fitsYou: [
      { label: 'Risk tolerance', detail: 'Low.' },
      { label: 'Experience', detail: 'Beginner-friendly.' },
      { label: 'Time commitment', detail: 'Low — 96 trades in demo data.' },
    ],
    dataBehindScore: [
      { label: 'Power Score', value: '6.9 / 10 (demo)' },
      { label: 'Demo return', value: '+15.8%' },
      { label: 'Sharpe (demo)', value: '1.55' },
      { label: 'Win rate (demo)', value: '64%' },
      { label: 'Trades (demo)', value: '96' },
    ],
    methodology: METHODOLOGY_SHARED,
    limitations: ['Entirely mock — simulated index, no real backtest evidence.'],
    evidence: [{ label: 'All metrics', detail: 'MOCK DEMO — simulated for product demonstration.' }],
    color: '#ffb86b',
    curve: [20, 22, 24, 25, 27, 29, 28, 32, 34, 37, 39, 42, 43, 47, 50, 54, 57, 59, 63, 68],
    updatedAt: '2025-02-10',
  },
];

export const findProfile = (id: string): StrategyProfile | undefined =>
  profiles.find((p) => p.id === id);

/** Owner-provided strategies only (for "real data" surfaces like the admin base). */
export const realProfiles = profiles.filter((p) => p.dataStatus === 'real');

export const CATALOG_CONTEXT_OPTIONS: { value: MarketContext | 'all'; label: string }[] = [
  { value: 'all', label: 'All contexts' },
  { value: 'trend', label: 'Trending markets' },
  { value: 'range', label: 'Range-bound markets' },
  { value: 'volatile', label: 'High volatility' },
  { value: 'multi', label: 'Multi-market' },
];

export const CATALOG_RISK_OPTIONS: { value: RiskLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All risk levels' },
  { value: 'low', label: 'Low risk' },
  { value: 'medium', label: 'Medium risk' },
  { value: 'high', label: 'High risk' },
];

export const CATALOG_EXPERIENCE_OPTIONS: { value: ExperienceLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'Any experience' },
  { value: 'beginner', label: 'Beginner-friendly' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const CATALOG_FREQUENCY_OPTIONS: { value: TradeFrequency | 'all'; label: string }[] = [
  { value: 'all', label: 'Any frequency' },
  { value: 'low', label: 'Low frequency' },
  { value: 'medium', label: 'Medium frequency' },
  { value: 'high', label: 'High frequency' },
];

/** Sanity invariant used by tests: dimension weighted sums match the power score. */
export function assertScoreConsistency(): string[] {
  const problems: string[] = [];
  for (const p of profiles) {
    const total = weightedSum(p.dimensions);
    if (Math.abs(total - p.metrics.powerScore) > 0.06) {
      problems.push(
        `${p.id}: weighted sum ${total.toFixed(2)} differs from power score ${p.metrics.powerScore}`,
      );
    }
    const w = p.dimensions.reduce((a, d) => a + d.weight, 0);
    if (Math.abs(w - 1) > 0.001) problems.push(`${p.id}: weights sum ${w}`);
  }
  return problems;
}
