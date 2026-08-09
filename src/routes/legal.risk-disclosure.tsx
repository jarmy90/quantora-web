import { createFileRoute } from '@tanstack/react-router';
import { LegalShell, type LegalSection } from '../components/LegalShell';
import '../styles/app.css';

const sections: LegalSection[] = [
  {
    heading: '1. Risk of Loss of Capital',
    body: 'Trading in financial markets, including cryptocurrencies, forex, indices, equities and other instruments, involves substantial risk of loss and is not suitable for every investor. You may lose all or substantially all of the capital you commit. You should never trade with funds you cannot afford to lose, and you should be aware that losses can occur quickly. Past or simulated performance is not indicative of future results.',
  },
  {
    heading: '2. Backtested and Mock Data vs. Live Trading',
    body: 'All performance figures, metrics and equity curves on this site are simulated or backtested mock data. They do not reflect live trading, real accounts, real capital or actual market conditions. Backtests are derived from historical data and modelling assumptions and have inherent limitations: they are typically optimised, assume ideal execution, and do not capture broader market regimes, regime changes or tail events. Live performance may differ materially and can be negative even where demo or backtest figures are positive.',
  },
  {
    heading: '3. Slippage, Fees, Spreads and Execution',
    body: 'Live execution is subject to slippage, bid/ask spreads, commissions, brokerage fees, financing/swap costs, liquidity constraints and platform latency. These costs and frictions are not fully reflected in mock or backtested data and can materially reduce — or eliminate — any returns that such data suggests. Market gaps and fast-moving conditions can cause orders to fill at prices significantly worse than expected.',
  },
  {
    heading: '4. Algorithmic and Technical Risk',
    body: 'Automated and algorithmic strategies can behave unpredictably. They rely on software, data feeds, connectivity, brokers and third-party services (including MetaTrader 5), any of which can fail, malfunction or be delayed. Errors in logic, configuration, deployment or data can lead to unintended orders, duplicate orders, or losses. You are responsible for monitoring any automated system and for understanding the technical and operational risks before use.',
  },
  {
    heading: '5. No Guarantee',
    body: 'Quantora makes no guarantees regarding the accuracy, completeness, reliability or profitability of any strategy, signal, metric or tool. Nothing on this site is a promise or representation of future performance. Quantora expressly disclaims any guarantee that any strategy will preserve capital or generate profit.',
  },
  {
    heading: '6. Suitability',
    body: 'Trading strategies shown on this site, including any future automated offerings, are not one-size-fits-all and are not suitable for every trader. You should consider your own objectives, experience, risk tolerance and financial situation, and consult qualified financial, legal and tax professionals, before committing any capital. If a strategy is not appropriate for you, you should not use it.',
  },
  {
    heading: '7. User Responsibility and Independent Verification',
    body: 'You are solely responsible for evaluating any strategy, understanding the risks involved, and making your own independent decisions. You should verify all information, read any documentation provided, and where possible test strategies in a forward, paper or demo environment before using them with real capital. Your use of the site and any strategy is at your own risk.',
  },
  {
    heading: '8. Placeholder, Not Final Nor Legal Advice',
    body: 'This disclosure is a working placeholder for demonstration purposes. It is not legal or regulatory advice, does not constitute a binding agreement, and has not been reviewed or approved by legal counsel. Before publication or use in production it must be reviewed and finalised by a qualified legal professional and adapted to the applicable jurisdiction. Additional regulatory disclosures or licencing obligations may apply depending on the products and services ultimately offered.',
  },
];

export const Route = createFileRoute('/legal/risk-disclosure')({
  component: () => (
    <LegalShell
      title="Risk Disclosure"
      updated="2025-02-20"
      sections={sections}
    />
  ),
});