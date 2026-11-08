import Link from "next/link";
import { formatCents } from "@/lib/money";
import { wheelPrizeRange, type WheelWithTiers } from "@/server/wheels/queries";

export function WheelCard({ wheel }: { wheel: WheelWithTiers }) {
  const { topProduct, minCents, maxCents } = wheelPrizeRange(wheel);
  const multiplier = topProduct ? (topProduct.valueCents / wheel.spinPriceCents).toFixed(1) : null;
  return (
    <article
      className="card flex flex-col gap-4 p-5 transition hover:-translate-y-0.5"
      style={{ ["--accent" as string]: wheel.accentColor }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{wheel.name}</h3>
          {wheel.tagline && <p className="text-sm text-muted">{wheel.tagline}</p>}
        </div>
        <div
          aria-hidden
          className="h-12 w-12 shrink-0 rounded-full border-4 border-bg shadow-[0_0_24px_-6px_var(--accent)]"
          style={{ background: `conic-gradient(${wheel.tiers.map((t, i, arr) => `${t.color} ${(arr.slice(0, i).reduce((a, x) => a + x.oddsBps, 0) / 100).toFixed(2)}% ${(arr.slice(0, i + 1).reduce((a, x) => a + x.oddsBps, 0) / 100).toFixed(2)}%`).join(", ")})` }}
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Spin price</dt>
          <dd className="font-mono text-lg font-semibold">{formatCents(wheel.spinPriceCents, { compact: true })}</dd>
        </div>
        <div>
          <dt className="text-muted">Prize range</dt>
          <dd className="font-mono">{formatCents(minCents, { compact: true })} – {formatCents(maxCents, { compact: true })}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted">Top prize</dt>
          <dd className="font-medium">
            {topProduct?.name ?? "—"}{" "}
            {multiplier && <span className="text-tier-chase">({multiplier}× your spin)</span>}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center gap-3">
        <Link href={`/wheels/${wheel.slug}`} className="btn-primary flex-1" style={{ background: wheel.accentColor }}>
          Open wheel
        </Link>
        <Link href={`/wheels/${wheel.slug}#odds`} className="btn-secondary">
          Odds
        </Link>
      </div>
    </article>
  );
}
