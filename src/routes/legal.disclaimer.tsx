import { createFileRoute } from '@tanstack/react-router';
import { LegalShell, type LegalSection } from '../components/LegalShell';
import '../styles/app.css';

const sections: LegalSection[] = [
  {
    heading: '1. General Disclaimer',
    body: 'Quantora is a demonstration product. Everything shown on this site — strategies, performance metrics, equity curves, licenses, downloads, trade logs, dashboards and pricing — is mock/demo data created for product evaluation. It does not represent real trading, real accounts, real orders, real licensing or real performance, and none of it should be relied upon as factual or verifiable.',
  },
  {
    heading: '2. No Investment, Financial, Legal or Tax Advice',
    body: 'Nothing on this website constitutes financial, investment, legal, tax or trading advice. Content is provided for informational and educational purposes only and is not a recommendation, solicitation or offer to buy or sell any financial instrument. You are solely responsible for your own investment decisions and for consulting a qualified professional where appropriate.',
  },
  {
    heading: '3. No Offer or Solicitation',
    body: 'No content on this site constitutes an offer, solicitation or invitation to acquire or dispose of any strategy, signal, license, security or financial product. Any future offering would be subject to separate terms, agreements and applicable law. The demo materials here are not a contract and create no binding obligations.',
  },
  {
    heading: '4. Mock/Backtested Data vs. Live Trading',
    body: 'All metrics and equity curves presented are simulated or backtested mock data. Simulated and backtested performance is generated from historical models and assumptions and is not a reliable indicator of future results. Live trading involves real order execution, market conditions, slippage, commissions, spreads, financing costs and latency, none of which are captured in mock data. Actual results may differ materially, including losses.',
  },
  {
    heading: '5. No Warranties',
    body: 'The site and all content are provided "as is" and "as available" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose and non-infringement. Quantora makes no representation that the service will be uninterrupted, error-free or secure, or that any particular result will be achieved. To the fullest extent permitted by law, Quantora and its affiliates disclaim all liability arising from your use of the site and its content.',
  },
  {
    heading: '6. Suitability and User Responsibility',
    body: 'Algorithmic and automated trading strategies are not suitable for all investors. You should assess whether any strategy fits your objectives, experience, risk tolerance and financial situation before committing capital. You are responsible for verifying any information on this site, for your own analysis and decisions, and for any consequences of using or relying on the content. You should consult legal, tax and financial professionals as appropriate for your circumstances.',
  },
  {
    heading: '7. Use at Your Own Risk',
    body: 'You use this site and its tools at your own risk. In no event shall Quantora be liable for any direct, indirect, incidental, special, consequential or punitive damages, including loss of profits, data, goodwill or capital, arising out of or in connection with your use of the site, even if advised of the possibility of such damages.',
  },
  {
    heading: '8. Placeholder for Legal Review',
    body: 'This page is a working placeholder. It does not reflect final policy, does not constitute a binding agreement, and has not been reviewed or approved by legal counsel. Before this material is used in production it must be reviewed and finalised by a qualified legal professional and adapted to the relevant regulatory jurisdiction. Additional regulatory disclosures may be required depending on the services ultimately offered.',
  },
];

export const Route = createFileRoute('/legal/disclaimer')({
  component: () => (
    <LegalShell
      title="Disclaimer"
      updated="2025-02-20"
      sections={sections}
    />
  ),
});
