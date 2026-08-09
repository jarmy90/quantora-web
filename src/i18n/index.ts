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
    'Discover rules-based strategies, inspect their behavior, and make more informed allocation decisions — without the black box.',
  'home.browse': 'Browse strategies →',
  'home.seeHow': 'See how it works',
  'home.mockNotice': '◉ ALL PERFORMANCE SHOWN IS MOCK / DEMO DATA',
  'home.curated': 'Curated systems',
  'home.signals': 'Signals worth a closer look.',
  'home.startingPoint': 'A starting point for your research, not a promise of returns.',
  'home.workflow': 'A clearer workflow',
  'home.workflowTitle': 'From curiosity to conviction.',
  'home.stepExplore': 'Explore',
  'home.stepExploreBody': 'Filter by asset, approach, return profile and risk.',
  'home.stepInspect': 'Inspect',
  'home.stepInspectBody': 'Open the curve, metrics and trade history behind each system.',
  'home.stepDecide': 'Decide',
  'home.stepDecideBody': 'Use the demo allocation panel to model your next step.',

  'trust.eyebrow': 'Trust & transparency',
  'trust.title': 'No hidden promises.',
  'trust.body':
    'Every figure on this page is clearly labeled mock data for product demonstration. Historical simulations do not predict future results. Quantora is not providing investment advice, execution, custody, or a guarantee of performance.',

  'common.demoReturn': 'Demo return',
  'common.risk': 'Risk',
  'common.maxDD': 'Max DD',
  'common.mockDemo': 'Strategy catalog / mock data',

  'catalog.title': 'Find your signal.',
  'catalog.body':
    'Compare transparent, rules-based systems built for different markets and risk profiles.',
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

  'footer.demo': 'Demo product · Not financial advice',
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
