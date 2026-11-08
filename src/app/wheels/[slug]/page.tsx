import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { locateRequest } from "@/server/providers/geo";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/config";
import { getWheelBySlug, wheelFullyStocked, wheelPrizeRange } from "@/server/wheels/queries";
import { listRecentWins } from "@/server/wheels/recent-wins";
import { getFairState } from "@/server/engine/spin";
import { previewSpinEligibility } from "@/server/engine/eligibility";
import { OddsTable } from "@/components/wheel/OddsTable";
import { WheelPlay } from "@/components/wheel/WheelPlay";
import { formatBps, formatCents } from "@/lib/money";

export async function generateMetadata({ params }: PageProps<"/wheels/[slug]">) {
  const { slug } = await params;
  const wheel = await getWheelBySlug(slug);
  return { title: wheel?.name ?? "Wheel" };
}

export default async function WheelPage({ params }: PageProps<"/wheels/[slug]">) {
  const { slug } = await params;
  const wheel = await getWheelBySlug(slug);
  if (!wheel || !wheel.isActive) notFound();
  const { minCents, maxCents, topProduct } = wheelPrizeRange(wheel);
  const stocked = wheelFullyStocked(wheel);
  const isDemo = isDemoMode();

  const session = await auth();
  let viewer: Parameters<typeof WheelPlay>[0]["viewer"] = null;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user) {
      const geo = await locateRequest(await headers());
      const [fair, eligibility] = await Promise.all([
        getFairState(user.id),
        previewSpinEligibility(prisma, user, { ipState: geo.stateCode, ipCountry: geo.countryCode, spinPriceCents: wheel.spinPriceCents, isDemo }),
      ]);
      viewer = {
        balanceCents: isDemo ? user.demoBalanceCents : user.realBalanceCents,
        fair,
        blocker: eligibility.ok ? null : { message: eligibility.message },
      };
    }
  }
  const recentWins = await listRecentWins({ wheelSlug: slug });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black">{wheel.name}</h1>
          {wheel.description && <p className="max-w-2xl text-muted">{wheel.description}</p>}
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div><dt className="inline text-muted">Spin </dt><dd className="inline font-mono font-semibold">{formatCents(wheel.spinPriceCents, { compact: true })}</dd></div>
          <div><dt className="inline text-muted">Prizes </dt><dd className="inline font-mono">{formatCents(minCents, { compact: true })} – {formatCents(maxCents, { compact: true })}</dd></div>
          {topProduct && (
            <div><dt className="inline text-muted">Top prize </dt><dd className="inline">{topProduct.name} <span className="text-tier-chase">({(topProduct.valueCents / wheel.spinPriceCents).toFixed(1)}×)</span></dd></div>
          )}
        </dl>
      </header>

      <WheelPlay
        wheel={{
          slug: wheel.slug,
          name: wheel.name,
          spinPriceCents: wheel.spinPriceCents,
          accentColor: wheel.accentColor,
          tiers: wheel.tiers.map((t) => ({ id: t.id, name: t.name, rarity: t.rarity, oddsBps: t.oddsBps, color: t.color })),
        }}
        stocked={stocked}
        isDemo={isDemo}
        viewer={viewer}
        recentWins={recentWins}
      />

      <section id="odds" className="card p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Odds & prizes</h2>
          <p className="text-sm text-muted">
            Odds total {formatBps(wheel.tiers.reduce((a, t) => a + t.oddsBps, 0))}. Wheel segments are drawn exactly proportional to these odds.
          </p>
        </div>
        <OddsTable wheel={wheel} />
      </section>
    </div>
  );
}
