import Link from "next/link";
import { listWheelsForAdmin } from "@/server/admin/wheels";
import { getSettings } from "@/server/settings";
import { formatCents } from "@/lib/money";
import { EvPanel } from "@/components/admin/EvPanel";

export const metadata = { title: "Admin · Wheels" };

export default async function AdminWheelsPage() {
  const [wheels, settings] = await Promise.all([listWheelsForAdmin(), getSettings()]);
  const range = { min: settings.rtpWarnMinPercent, max: settings.rtpWarnMaxPercent };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Wheels & odds</h1>
        <Link href="/admin/wheels/new" className="btn-primary px-3 py-1.5 text-sm">+ New wheel</Link>
      </div>
      <ul className="space-y-4">
        {wheels.map((w) => (
          <li key={w.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">
                  <Link href={`/admin/wheels/${w.id}`} className="hover:text-accent">{w.name}</Link>
                  {!w.isActive && <span className="badge ml-2 bg-danger/20 text-danger">inactive</span>}
                </h2>
                <p className="text-sm text-muted">{formatCents(w.spinPriceCents, { compact: true })} per spin · {w.tiers.filter((t) => t.oddsBps > 0).length} tiers · {w._count.spins} spins</p>
              </div>
              <Link href={`/admin/wheels/${w.id}`} className="btn-secondary px-3 py-1.5 text-xs">Edit</Link>
            </div>
            <div className="mt-3"><EvPanel ev={w.ev} rtpRange={range} compact /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
