import Link from "next/link";
import { prisma } from "@/server/db";
import { config } from "@/server/config";
import { listWheelsForAdmin } from "@/server/admin/wheels";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Admin" };

/** Server component: computed once per request, so reading the clock here is fine. */
function last24h(): Date {
  return new Date(Date.now() - 24 * 3_600_000);
}

export default async function AdminHome() {
  const since = last24h();
  const [users, products, spins, spins24, openOrders, pendingVault, wheels, outOfStock] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.spin.count(),
    prisma.spin.aggregate({ where: { createdAt: { gte: since } }, _count: true, _sum: { spinPriceCents: true, productValueCents: true } }),
    prisma.order.count({ where: { status: { in: ["REQUESTED", "PROCESSING"] } } }),
    prisma.vaultItem.count({ where: { status: "PENDING" } }),
    listWheelsForAdmin(),
    prisma.product.findMany({ where: { stock: { lt: 1 }, tiers: { some: {} } }, select: { id: true, name: true } }),
  ]);
  const warn = wheels.filter((w) => w.ev.warnings.length > 0);
  const stats = [
    ["Users", users], ["Products", products], ["Spins (all time)", spins], ["Spins (24h)", spins24._count],
    ["Taken (24h)", formatCents(spins24._sum.spinPriceCents ?? 0)], ["Prize value (24h)", formatCents(spins24._sum.productValueCents ?? 0)],
    ["Open orders", openOrders], ["Vault items pending", pendingVault],
  ] as const;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="text-sm">
        Launch mode:{" "}
        <span className={`badge ${config.realMoneyEnabled ? "bg-danger/20 text-danger" : "bg-warning/20 text-warning"}`}>{config.realMoneyEnabled ? "REAL MONEY ENABLED" : "DEMO MODE"}</span>
      </p>
      <dl className="grid gap-4 sm:grid-cols-4">
        {stats.map(([k, v]) => (<div key={k} className="card p-4"><dt className="text-xs uppercase tracking-wide text-muted">{k}</dt><dd className="mt-1 font-mono text-2xl font-semibold">{v}</dd></div>))}
      </dl>
      <section className="card space-y-2 p-5 text-sm">
        <h2 className="text-lg font-bold">Attention</h2>
        {warn.length === 0 && outOfStock.length === 0 && openOrders === 0 && <p className="text-muted">Nothing needs attention.</p>}
        {outOfStock.length > 0 && <p className="text-danger">Out of stock (wheels paused): {outOfStock.map((p) => <Link key={p.id} href={`/admin/products/${p.id}`} className="underline">{p.name}</Link>).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])}</p>}
        {warn.map((w) => (<p key={w.id}><Link href={`/admin/wheels/${w.id}`} className="font-medium underline">{w.name}</Link>: {w.ev.warnings.map((x) => x.message).join(" ")}</p>))}
        {openOrders > 0 && <p><Link href="/admin/orders?status=REQUESTED" className="underline">{openOrders} order{openOrders === 1 ? "" : "s"}</Link> waiting to ship.</p>}
      </section>
    </div>
  );
}
