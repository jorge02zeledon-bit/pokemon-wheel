import { notFound } from "next/navigation";
import { getWheelBySlug, wheelFullyStocked, wheelPrizeRange } from "@/server/wheels/queries";
import { OddsTable } from "@/components/wheel/OddsTable";
import { formatCents } from "@/lib/money";
import { Alert } from "@/components/ui/Alert";

export async function generateMetadata({ params }: PageProps<"/wheels/[slug]">) {
  const { slug } = await params;
  const wheel = await getWheelBySlug(slug);
  return { title: wheel?.name ?? "Wheel" };
}

/**
 * Phase 1 placeholder: static disclosure of the wheel. The animated wheel,
 * spin button and recent wins feed arrive in Phase 3.
 */
export default async function WheelPage({ params }: PageProps<"/wheels/[slug]">) {
  const { slug } = await params;
  const wheel = await getWheelBySlug(slug);
  if (!wheel || !wheel.isActive) notFound();
  const { minCents, maxCents, topProduct } = wheelPrizeRange(wheel);
  const stocked = wheelFullyStocked(wheel);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-black">{wheel.name}</h1>
        {wheel.description && <p className="max-w-2xl text-muted">{wheel.description}</p>}
      </header>

      <dl className="grid gap-4 sm:grid-cols-4">
        {[
          ["Spin price", formatCents(wheel.spinPriceCents, { compact: true })],
          ["Minimum prize", formatCents(minCents, { compact: true })],
          ["Maximum prize", formatCents(maxCents, { compact: true })],
          ["Top prize", topProduct?.name ?? "—"],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <dt className="text-xs uppercase tracking-wide text-muted">{k}</dt>
            <dd className="mt-1 font-mono text-lg font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {!stocked && <Alert kind="warning">This wheel is paused until every prize is back in stock.</Alert>}

      <section id="odds" className="card p-5">
        <h2 className="mb-4 text-xl font-bold">Odds & prizes</h2>
        <OddsTable wheel={wheel} />
      </section>
    </div>
  );
}
