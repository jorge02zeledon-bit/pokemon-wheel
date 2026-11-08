import Link from "next/link";
import { listActiveWheels, wheelPrizeRange } from "@/server/wheels/queries";
import { OddsTable } from "@/components/wheel/OddsTable";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Odds & Rules" };

export default async function OddsPage() {
  const wheels = await listActiveWheels();
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-black">Odds & Rules</h1>
        <p className="max-w-2xl text-muted">
          Every wheel&apos;s tiers, odds and prizes are listed below exactly as configured on the server.
          Odds for each wheel always total 100%. Full rules are in the{" "}
          <Link href="/legal/rules" className="text-accent underline">Official Rules</Link>.
        </p>
      </header>
      {wheels.map((w) => {
        const r = wheelPrizeRange(w);
        return (
          <section key={w.id} className="card p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">
                <Link href={`/wheels/${w.slug}`} className="hover:text-accent">{w.name}</Link>
              </h2>
              <p className="font-mono text-sm text-muted">
                {formatCents(w.spinPriceCents, { compact: true })} per spin · prizes{" "}
                {formatCents(r.minCents, { compact: true })} – {formatCents(r.maxCents, { compact: true })}
              </p>
            </div>
            <OddsTable wheel={w} />
          </section>
        );
      })}
    </div>
  );
}
