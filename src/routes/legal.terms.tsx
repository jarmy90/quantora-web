import { createFileRoute } from '@tanstack/react-router';
import { LegalShell, type LegalSection } from '../components/LegalShell';
import '../styles/app.css';

const sections: LegalSection[] = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By accessing or using the Quantora.io preview site, you agree to be bound by these placeholder Terms of Use. If you do not agree, please discontinue use of the site. These terms are a draft and must be reviewed by legal counsel before production use.',
  },
  {
    heading: '2. Demo Content',
    body: 'All strategies, performance figures, licenses, downloads and account features are simulated for demonstration. They create no rights, obligations, purchases, licenses or entitlements. Any "simulate", "buy", "rent" or "download" controls are illustrative only and do not execute real transactions.',
  },
  {
    heading: '3. Acceptable Use',
    body: 'You agree not to misuse the site, attempt unauthorized access, or use the content for any deceptive, fraudulent or unlawful purpose. You may not misrepresent Quantora or reproduce the site content without authorization.',
  },
  {
    heading: '4. Limitation of Liability',
    body: 'To the maximum extent permitted by law, Quantora shall not be liable for any direct, indirect, incidental, consequential or special damages arising from your use of, or reliance on, the site or its content.',
  },
  {
    heading: '5. Changes',
    body: 'These terms may be updated from time to time. Continued use of the site after changes are posted constitutes acceptance of the revised terms.',
  },
];

export const Route = createFileRoute('/legal/terms')({
  component: () => (
    <LegalShell
      title="Terms of Use"
      updated="2025-02-20"
      sections={sections}
    />
  ),
});