import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="November 2026">
      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> email, display name, password hash, state of residence, age confirmation.</li>
        <li><strong>Identity verification data:</strong> handled by our verification provider [PROVIDER NAME]; we store the outcome (approved / rejected), a provider reference and the reason, not your documents.</li>
        <li><strong>Activity data:</strong> spins (including provably fair seeds), vault decisions, orders and shipping addresses, balances and transactions, limit and self-exclusion settings.</li>
        <li><strong>Location signals:</strong> your IP address and the country/state derived from it, recorded with each spin to enforce state restrictions. [GEO PROVIDER NAME] performs the lookup.</li>
        <li><strong>Technical data:</strong> browser and device information, cookies required to keep you signed in, and a local flag remembering that you passed the age gate.</li>
      </ul>
      <h2>2. How we use it</h2>
      <p>To operate the Service, verify eligibility and identity, prevent fraud and multiple accounts, fulfil shipping, enforce responsible-play tools, respond to support requests, and comply with law. We do not sell personal information. [ADVERTISING / ANALYTICS DISCLOSURES IF ANY.]</p>
      <h2>3. Sharing</h2>
      <p>With service providers acting on our behalf: hosting ([HOSTING PROVIDER]), database ([DATABASE PROVIDER]), file storage ([STORAGE PROVIDER]), email ([EMAIL PROVIDER]), identity verification, geolocation, payment processing (when enabled) and shipping carriers. With authorities when required by law.</p>
      <h2>4. Retention</h2>
      <p>Spin and transaction records are retained for [RETENTION PERIOD] because they form an audit trail that cannot be edited. Account data is retained while your account is open and for [PERIOD] after closure. Self-exclusion records are retained for the duration of the exclusion plus [PERIOD].</p>
      <h2>5. Your choices and rights</h2>
      <p>You can view and update profile details, set limits, and request a copy or deletion of your data at [PRIVACY EMAIL], subject to records we must keep. [STATE PRIVACY LAW DISCLOSURES, e.g. CCPA/CPRA, TO BE COMPLETED BY COUNSEL.]</p>
      <h2>6. Security</h2>
      <p>Passwords are hashed, transport is encrypted, administrative actions are logged, and money and spin records are append-only at the database level. No system is perfectly secure; report concerns to [SECURITY EMAIL].</p>
      <h2>7. Children</h2>
      <p>The Service is for adults 18+. We do not knowingly collect data from anyone under 18 and will delete it if discovered.</p>
      <h2>8. Contact</h2>
      <p>[LEGAL ENTITY NAME], [ADDRESS], [PRIVACY EMAIL].</p>
    </LegalPage>
  );
}
