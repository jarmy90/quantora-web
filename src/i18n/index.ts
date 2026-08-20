/**
 * Application localization boundary. English is intentionally the only active locale
 * for Phase 1; add another dictionary and register it in `messages` to extend this.
 */
export type Locale = 'en-US';
export const defaultLocale: Locale = 'en-US';
type MessageValue = string;
export type MessageKey = keyof typeof enUS;
export const enUS = {
  'nav.howItWorks': 'How it works',
  'nav.strategies': 'Strategies',
  'nav.trustRisk': 'Trust & risk',
  'nav.explore': 'Explore strategies',
  'nav.home': 'Home',
  'nav.catalog': 'Catalog',
  'nav.dashboard': 'Dashboard',
  'nav.mockEnvironment': 'MOCK ENVIRONMENT',
  'nav.backCatalog': '← Catalog',

  'home.eyebrow': 'Systematic investing · made legible',
  'home.heroTitle': 'Strategies you can',
  'home.heroAccent': 'understand.',
  'home.heroBody':
    'Cut through the noise of unverified bots and trading promises. Explore rules-based strategies evaluated through structured backtesting, with performance, risk and limitations shown clearly.',
  'home.browse': 'Browse strategies →',
  'home.seeHow': 'See how it works',
  'home.mockNotice': 'HISTORICAL RESULTS DO NOT GUARANTEE FUTURE PERFORMANCE',
  'home.curated': 'Curated systems',
  'home.signals': 'Signals worth a closer look.',
  'home.startingPoint': 'A starting point for your research, not a promise of returns.',
  'home.demoNote': 'Demo data — shown here for product demonstration only.',
  'home.workflow': 'A more rigorous way to evaluate strategies',
  'home.workflowTitle': 'Less promise. More evidence.',
  'home.workflowIntro':
    'The internet and social media are full of strategies, signals and trading bots promoted through attractive screenshots, isolated results and claims that are difficult to verify. Quantora offers a more rigorous alternative: explainable strategies evaluated through a consistent backtesting methodology and presented with their complete historical results, including risk and limitations.',
  'home.stepAnalyze': 'Analyze',
  'home.stepAnalyzeBody':
    'We process each strategy’s historical record through a structured methodology. We examine closed trades, the equity curve, Profit Factor, drawdown, frequency, stability and available costs.',
  'home.stepFilter': 'Filter',
  'home.stepFilterBody':
    'Every strategy is assessed using the same publication criteria. If the evidence is insufficient or the strategy does not meet the minimum standard, it does not appear in the public catalog.',
  'home.stepShow': 'Show the complete picture',
  'home.stepShowBody':
    'We present potential and risk together, without selecting only the best periods. Users can inspect the equity curve, metrics, Quantora Score and limitations before making their own decision.',
  'home.workflowClose':
    'We do not promise returns. We build a clearer and more rigorous way to evaluate strategies.',

  'trust.eyebrow': 'Transparency by design',
  'trust.title': 'The complete picture, not just the best trades.',
  'trust.body':
    'Quantora presents historical performance together with drawdown, trade count, costs, analyzed period and known limitations. Real strategies and demonstration data are clearly separated. Historical results are evidence for evaluation, not a promise of future returns.',

  'common.demoReturn': 'Demo return',
  'common.risk': 'Risk',
  'common.maxDD': 'Max DD',
  'common.mockDemo': 'Strategy catalog / mock data',
  'common.ownerSupplied': 'Owner supplied',
  'common.independentReproductionPending': 'Independent reproduction pending',

  'catalog.title': 'Find your signal.',
  'catalog.body':
    'Compare transparent, rules-based systems built for different markets and risk profiles.',
  'catalog.eyebrow': 'Strategy catalog',
  'catalog.published': 'Published strategies',
  'catalog.demoSection': 'Demo strategies · mock data',
  'catalog.demoNote':
    'Mock / demo data for product demonstration — kept separate from the published strategies above.',
  'catalog.sortReturn': 'Sort: demo return',
  'catalog.sortName': 'Sort: name',

  'detail.eyebrow': 'Strategy detail / MOCK DEMO',
  'detail.curve': 'EQUITY CURVE · MOCK SIMULATION',
  'detail.period': 'Period',
  'detail.simulatedIndex': 'simulated index',
  'detail.snapshot': 'Performance snapshot',
  'detail.sharpe': 'Sharpe ratio',
  'detail.maxDrawdown': 'Max drawdown',
  'detail.winRate': 'Win rate',
  'detail.totalTrades': 'Total trades',
  'detail.dataStatus': 'Data status',
  'detail.score': 'Quantora Score',
  'detail.profitFactor': 'Profit Factor',
  'detail.frequency': 'Frequency',
  'detail.costs': 'Costs',
  'detail.netResult': 'Net result',
  'detail.market': 'Market',
  'detail.instrument': 'Instrument',
  'detail.version': 'Version',
  'detail.howItWorks': 'How it works',
  'detail.limitations': 'Limitations',
  'detail.researchNote':
    'Historical backtest — analyzes past results; it does not represent live trading or open real orders.',
  'detail.freqPerMonth': 'per month',
  'detail.equityCurve': 'Equity curve',
  'detail.drawdownValue': 'Drawdown',
  'detail.tradeLog': 'Trade log · simulated',
  'detail.date': 'Date',
  'detail.asset': 'Asset',
  'detail.side': 'Side',
  'detail.demoPnL': 'Demo P&L',
  'detail.access': 'Simulated access',
  'detail.model': 'Model this strategy',
  'detail.modelBody':
    'Explore a hypothetical allocation and license. No purchase, payment, execution or real license is created.',
  'detail.allocation': 'DEMO ALLOCATION',
  'detail.fee': 'Illustrative fee',
  'detail.simulate': 'Simulate allocation',
  'detail.alert': 'Demo only — no transaction created.',
  'detail.licenseOption': 'License model · MOCK',
  'detail.rent': 'Rental',
  'detail.buy': 'Full license',
  'detail.rentDesc': 'Recurring · cancel anytime',
  'detail.buyDesc': 'One-time · lifetime updates',
  'detail.rentPrice': '$49',
  'detail.buyPrice': '$299',
  'detail.perMonth': '/month',
  'detail.once': 'one-time',
  'detail.curveFor': 'Simulated index ·',
  'detail.notFound': 'Strategy not found',
  'detail.notFoundBody':
    'The strategy you are looking for does not exist. Browse the catalog to explore available systems.',
  'detail.backCatalog': '← Back to catalog',
  'detail.scoreBeta': 'Quantora Score · Beta',
  'detail.scoreBetaNote':
    'Experimental comparative score based on available historical evidence. It is not an independent validation.',
  'detail.costsNotApplied': 'Costs not applied',
  'detail.costsWarning': 'Reported performance may be reduced after commission, spread, slippage and swap.',
  'detail.historicalBacktest': 'Historical backtest',
  'detail.resultsInPoints': 'Results in points',
  'detail.closedTradeDrawdown': 'Closed-trade drawdown',
  'detail.drawdownNote': 'Peak-to-trough drawdown calculated from closed-trade equity.',
  'detail.evidence': 'Evidence',
  'detail.evidenceClosedTrade':
    'Historical backtest on XAUUSD M15. Results are expressed in points and include 203 closed trades. One position remained open at the end of the test and is excluded from the closed-trade metrics. The equity curve and drawdown are calculated at closed-trade level, not from intratrade account equity. Owner-supplied evidence. Independent reproduction pending.',
  'detail.closedTradeEquity': 'Closed-trade equity · points',
  'detail.openPositionsAtEnd': 'Open positions at end',
  'detail.expectancy': 'Expectancy',
  'detail.ptsPerTrade': 'pts/trade',

  'dashboard.eyebrow': 'Account dashboard / MOCK PREVIEW',
  'dashboard.title': 'Your workspace.',
  'dashboard.body':
    'A simulated preview of licenses, downloads and account history. Nothing here is real — there is no authentication, no payments and no live delivery.',
  'dashboard.demo': 'This is a simulated demo panel. No real licenses, downloads, payments or accounts are managed on this site.',
  'dashboard.licenses': 'Licenses',
  'dashboard.downloads': 'Downloads',
  'dashboard.history': 'Recent activity',
  'dashboard.status': 'Status',
  'dashboard.expires': 'Expires',
  'dashboard.type': 'Model',
  'dashboard.name': 'Name',
  'dashboard.format': 'Format',
  'dashboard.size': 'Size',
  'dashboard.date': 'Date',
  'dashboard.event': 'Event',
  'dashboard.detail': 'Detail',
  'dashboard.emptyLicenses': 'No licenses yet. Explore the catalog to model one in demo mode.',
  'dashboard.emptyDownloads': 'No downloads in this demo workspace.',
  'dashboard.emptyHistory': 'No activity recorded.',
  'dashboard.viewStrategy': 'View',

  'legal.eyebrow': 'Legal / PLACEHOLDER',
  'legal.review':
    '⚠ PLACEHOLDER DRAFT — For demonstration only. This page is a template and has not been reviewed or approved by legal counsel. It must be reviewed by a qualified professional before being relied upon or published in production.',
  'legal.updated': 'Last updated',
  'legal.home': '← Home',
  'legal.financial':
    'Nothing on this site constitutes financial, investment or trading advice. All metrics and simulations are mock/demo data for product demonstration and do not represent or guarantee future performance. Trading involves substantial risk of loss.',
  'legal.placeholderSection':
    '(Placeholder section — content to be completed and reviewed by legal counsel.)',

  'footer.demo': 'Historical results do not guarantee future performance · Not financial advice',
  'footer.mock': 'Figures are MOCK / DEMO only · Not investment advice',
  'footer.detail': 'MOCK / DEMO DATA · Historical simulation is not indicative of future results · Not financial advice',
  'footer.tagline': 'Algorithmic strategy discovery & evaluation · MetaTrader 5',
  'footer.product': 'Product',
  'footer.legal': 'Legal',
  'footer.legalDisclaimer': 'Disclaimer',
  'footer.legalTerms': 'Terms of Use',
  'footer.legalPrivacy': 'Privacy Policy',
  'footer.legalRisk': 'Risk Disclosure',
  'footer.legalReview':
    'These legal pages are placeholders and must be reviewed by a qualified legal professional before use.',
  'footer.rights': 'Demo experience. Not financial advice.',
} as const satisfies Record<string, MessageValue>;
export const messages: Record<Locale, Record<MessageKey, string>> = { 'en-US': enUS };
export function t(key: MessageKey): string {
  return messages[defaultLocale][key];
}
export function languageTag(): string {
  return defaultLocale;
}
