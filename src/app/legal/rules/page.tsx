import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { listActiveWheels, wheelPrizeRange } from "@/server/wheels/queries";
import { getSettings } from "@/server/settings";
import { prisma } from "@/server/db";
import { formatBps, formatCents } from "@/lib/money";

export const metadata = { title: "Official Rules" };

export default async function RulesPage() {
  const [wheels, settings, blocked] = await Promise.all([listActiveWheels(), getSettings(), prisma.blockedState.findMany({ orderBy: { name: "asc" } })]);
  return (
    <LegalPage title="Official Rules" updated="November 2026">
      <h2>1. Overview</h2>
      <p>Each spin on a HonshuWheel prize wheel costs the displayed spin price and awards exactly one sealed product from that wheel&apos;s prize list. There are no losing spins. The tier is selected at random with the published odds; within a tier, each listed product is equally likely.</p>
      <h2>2. Eligibility</h2>
      <p>Participants must be 18 or older, hold a verified account where required, and be located in a permitted US state at the time of the spin. Spins are not available to residents of, or from locations in: {blocked.map((b) => b.name).join(", ") || "[NONE]"}. The current list is enforced automatically and may change.</p>
      <h2>3. Odds and prizes (live)</h2>
      <p>The following reflects the configuration in force right now. The same information is shown on each wheel page before you spin.</p>
      {wheels.map((w) => {
        const r = wheelPrizeRange(w);
        return (
          <div key={w.id} className="rounded-xl border border-border p-4">
            <p className="font-semibold">{w.name} — {formatCents(w.spinPriceCents, { compact: true })} per spin · prizes {formatCents(r.minCents, { compact: true })} to {formatCents(r.maxCents, { compact: true })}</p>
            <ul>
              {w.tiers.map((t) => (
                <li key={t.id}>{t.name} ({formatBps(t.oddsBps)}): {t.products.map((tp) => `${tp.product.name} (${formatCents(tp.product.valueCents, { compact: true })})`).join("; ")}</li>
              ))}
            </ul>
          </div>
        );
      })}
      <h2>4. How outcomes are determined</h2>
      <p>Outcomes are computed on our servers from a committed server seed, your client seed and a nonce, as described on the <Link href="/fair" className="underline">Provably Fair</Link> page, and recorded in an append-only log before any result is displayed. The displayed wheel animation has no effect on the outcome.</p>
      <h2>5. Availability of prizes</h2>
      <p>A wheel is automatically paused whenever any prize it can award is out of stock. Won units are reserved for the winner at the moment of the spin.</p>
      <h2>6. Prize decisions</h2>
      <p>Winners have {settings.vaultWindowDays} days to choose shipping (flat fee {formatCents(settings.shippingFeeCents)}) or buyback at {settings.buybackPercent}% of the listed value. If no choice is made, {settings.vaultDefaultAction === "AUTO_SELL" ? "the item is automatically sold back and the buyback amount credited" : "the item is held for shipping until a shipping address is provided"}. Listed values are shown at the time of the win and used for buyback.</p>
      <h2>7. Demo mode</h2>
      <p>When the Service is operating in demo mode, spins use demo credits with no cash value; prizes won with demo credits may be sold back for demo credits only and cannot be shipped.</p>
      <h2>8. Disputes and errors</h2>
      <p>In the event of a technical error, the recorded spin log controls. [DISPUTE PROCEDURE AND CONTACT, TO BE DRAFTED BY COUNSEL.]</p>
      <h2>9. Sponsor</h2>
      <p>[LEGAL ENTITY NAME], [ADDRESS]. Not affiliated with, endorsed by, or sponsored by The Pokémon Company, Nintendo, Creatures, or Game Freak.</p>
    </LegalPage>
  );
}
