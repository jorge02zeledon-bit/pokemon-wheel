import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="November 2026">
      <h2>1. Who we are</h2>
      <p>HonshuWheel (&quot;we&quot;, &quot;us&quot;) is operated by [LEGAL ENTITY NAME], a [STATE] [ENTITY TYPE] with its principal place of business at [ADDRESS]. These Terms govern your use of honshuwheel.com and related services (the &quot;Service&quot;).</p>
      <h2>2. Eligibility</h2>
      <ul>
        <li>You must be at least 18 years old (or the age of majority where you live, if higher).</li>
        <li>You must be physically located in, and a resident of, a United States state where the Service is permitted. The Service is not available in [BLOCKED STATES, kept in sync with the admin list; currently Nevada, Washington and Montana] and anywhere else we determine the Service is not lawful.</li>
        <li>You may hold one account. We may require identity verification at any time and before any deposit or withdrawal.</li>
      </ul>
      <h2>3. How the Service works</h2>
      <p>Each wheel awards one sealed product per spin. The prizes, their listed values and the odds for each tier are displayed on the wheel page before you spin and on the Odds &amp; Rules page. Outcomes are determined on our servers using a provably fair process described on the Provably Fair page. The on-screen animation only displays a result that has already been determined and recorded.</p>
      <h2>4. Balances, demo credits and payments</h2>
      <ul>
        <li>Demo credits have no cash value, cannot be withdrawn or transferred, and may be reset or removed at any time.</li>
        <li>Real-money deposits and withdrawals are available only when enabled, after identity verification, and subject to the limits you set and the limits we impose. [PAYMENT PROCESSOR TERMS].</li>
        <li>All amounts are in US dollars. Spin prices are final once a spin is executed.</li>
      </ul>
      <h2>5. Prizes, vault, buyback and shipping</h2>
      <p>Won items are placed in your vault. Within the decision window shown in your vault (currently [VAULT WINDOW] days) you may request shipping (subject to the Shipping &amp; Buyback Policy and a flat shipping fee) or sell the item back to us for the buyback percentage of its listed value shown before you confirm. If you take no action, the default action described in the Shipping &amp; Buyback Policy applies. Listed values are our good-faith estimates of market value and are not guarantees of resale value.</p>
      <h2>6. Responsible play</h2>
      <p>You may set deposit and spend limits, take a break, or self-exclude from your account page. Self-exclusion cannot be reversed early. If you believe you have a gambling problem, call or text 1-800-GAMBLER.</p>
      <h2>7. Prohibited conduct</h2>
      <ul>
        <li>Using the Service from a restricted location or misrepresenting your age, identity or location (including through VPNs or proxies).</li>
        <li>Automation, exploitation of bugs, chargebacks in bad faith, or interference with the fairness mechanism.</li>
        <li>Creating multiple accounts or allowing others to use your account.</li>
      </ul>
      <h2>8. Intellectual property and trademarks</h2>
      <p>HonshuWheel is not affiliated with, endorsed by, or sponsored by The Pokémon Company, Nintendo, Creatures, or Game Freak. Product names are used solely to identify genuine sealed merchandise offered as prizes. All product photographs are our own.</p>
      <h2>9. Disclaimers and limitation of liability</h2>
      <p>[STANDARD DISCLAIMER OF WARRANTIES AND LIMITATION OF LIABILITY, TO BE DRAFTED BY COUNSEL.]</p>
      <h2>10. Disputes</h2>
      <p>[GOVERNING LAW, VENUE AND DISPUTE RESOLUTION / ARBITRATION CLAUSE, TO BE DRAFTED BY COUNSEL.]</p>
      <h2>11. Changes and contact</h2>
      <p>We may update these Terms; material changes will be announced on the Service. Contact: [SUPPORT EMAIL].</p>
    </LegalPage>
  );
}
