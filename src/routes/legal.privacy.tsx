import { createFileRoute } from '@tanstack/react-router';
import { LegalShell, type LegalSection } from '../components/LegalShell';
import '../styles/app.css';

const sections: LegalSection[] = [
  {
    heading: '1. Information We Collect',
    body: 'This is a demo site and currently collects no personal data. In a future, production version, we may collect basic account and usage information. This placeholder policy will be updated before any real data collection begins.',
  },
  {
    heading: '2. How We Use Information',
    body: 'Any future data would be used solely to provide and improve the Quantora service — for example, to display your licenses, downloads and history. We do not sell personal data.',
  },
  {
    heading: '3. Cookies & Analytics',
    body: 'Nothing on this demo relies on cookies or third-party tracking. If analytics are introduced later, details will be added to this policy.',
  },
  {
    heading: '4. Data Security & Your Rights',
    body: 'Appropriate safeguards would be applied to protect any data. You would be able to request access to, correction of, or deletion of your data. This section is a placeholder and subject to review.',
  },
];

export const Route = createFileRoute('/legal/privacy')({
  component: () => (
    <LegalShell
      title="Privacy Policy"
      updated="2025-02-20"
      sections={sections}
    />
  ),
});