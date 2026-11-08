import { LegalPage } from "@/components/legal/LegalPage";
import { getSettings } from "@/server/settings";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Shipping & Buyback Policy" };

export default async function ShippingPage() {
  const s = await getSettings();
  return (
    <LegalPage title="Shipping & Buyback Policy" updated="November 2026">
      <h2>1. Your options after a win</h2>
      <p>Every won item goes to your vault with a decision window of {s.vaultWindowDays} days. During that window you can request shipping or sell the item back. After the window, the default action is: {s.vaultDefaultAction === "AUTO_SELL" ? "automatic buyback at the rate below" : "the item is held for shipping until you add an address"}.</p>
      <h2>2. Buyback</h2>
      <ul>
        <li>Buyback price is {s.buybackPercent}% of the item&apos;s listed value at the time you won it, rounded to the nearest cent, and is shown before you confirm.</li>
        <li>Proceeds are credited instantly to the balance you played with (demo credits for demo wins, account balance for real-money wins).</li>
        <li>Buyback is final and cannot be reversed.</li>
      </ul>
      <h2>3. Shipping</h2>
      <ul>
        <li>Shipping is available only for items won with real money, when real-money play is enabled, to addresses in the United States. [INTERNATIONAL / PO BOX / APO POLICY.]</li>
        <li>A flat fee of {formatCents(s.shippingFeeCents)} per shipping request is charged to your balance when you submit the request.</li>
        <li>Items ship sealed, as described, within [HANDLING TIME] business days via [CARRIERS]. Tracking is added to your vault once available.</li>
        <li>You are responsible for providing an accurate address. [LOST / DAMAGED / RETURNED PACKAGE POLICY AND INSURANCE TERMS.]</li>
        <li>[SALES TAX TREATMENT, TO BE CONFIRMED BY COUNSEL / ACCOUNTANT.]</li>
      </ul>
      <h2>4. Condition and authenticity</h2>
      <p>All prizes are factory-sealed products sourced from [SOURCING STATEMENT]. Listed values are our good-faith market estimates and may differ from prices elsewhere.</p>
      <h2>5. Contact</h2>
      <p>[SUPPORT EMAIL].</p>
    </LegalPage>
  );
}
