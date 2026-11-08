import Link from "next/link";
import { getSettings } from "@/server/settings";
import { formatCents } from "@/lib/money";
import { isDemoMode } from "@/server/config";

export const metadata = { title: "FAQ" };

export default async function FaqPage() {
  const s = await getSettings();
  const demo = isDemoMode();
  const faqs: [string, React.ReactNode][] = [
    ["What is HonshuWheel?", "A prize wheel site. Every spin wins a real, sealed trading card product from the wheel's prize list. The tier you land on is random; the odds are published on every wheel before you spin."],
    ["Does every spin win something?", "Yes. There are no empty segments. Each wheel also shows the minimum and maximum prize value so you know the range before spinning."],
    ["How do I know the result is fair?", <>Outcomes are computed on our server with a cryptographic commitment scheme and can be independently verified. See <Link href="/fair" className="underline">Provably Fair</Link> for the exact algorithm and a verifier that runs in your browser.</>],
    ["Are the wheel segments the real odds?", "Yes. Segment sizes are drawn exactly proportional to the published odds. Large tiers are split into several slices spread around the wheel, but their total size equals their odds."],
    ["What happens after I win?", <>The item goes to your <Link href="/vault" className="underline">vault</Link>. You have {s.vaultWindowDays} days to either ship it (flat fee {formatCents(s.shippingFeeCents)}) or sell it back for {s.buybackPercent}% of its listed value as account credit. If you do nothing, the default action ({s.vaultDefaultAction === "AUTO_SELL" ? "automatic sell-back" : "hold for shipping"}) applies.</>],
    ["Can a wheel run out of prizes?", "A wheel is paused automatically if any prize it can award, including the top chase prize, is out of stock. You can never spin a wheel whose advertised prizes are not actually available."],
    demo
      ? ["What is demo mode?", "The site is currently running with free demo credits. Spins, the vault and buyback all work, but demo credits have no cash value, and deposits, withdrawals and shipping are disabled."]
      : ["How do deposits and withdrawals work?", "Through the payment options shown in your wallet. Identity verification is required before your first deposit or withdrawal."],
    ["Who can play?", "You must be 18 or older and located in a state where we operate. Some US states are excluded; the list is checked both against the state on your account and your current location."],
    ["How do I set limits or take a break?", <>From your <Link href="/account#responsible-play" className="underline">account page</Link> you can set deposit limits, take a timed break, or self-exclude. Self-exclusion cannot be undone early. If gambling is a problem for you or someone you know, call or text 1-800-GAMBLER.</>],
    ["Is HonshuWheel affiliated with the trading card publisher?", "No. HonshuWheel is not affiliated with, endorsed by, or sponsored by The Pokémon Company, Nintendo, Creatures, or Game Freak. Product names are used only to identify sealed merchandise."],
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-black">FAQ</h1>
      <div className="space-y-3">
        {faqs.map(([q, a]) => (
          <details key={q} className="card p-5">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-3 text-sm text-muted">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
