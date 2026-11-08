import Link from "next/link";
import { OrderStatus } from "@prisma/client";
import { listOrdersForAdmin } from "@/server/admin/orders";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Admin · Orders" };

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && (Object.values(OrderStatus) as string[]).includes(sp.status) ? (sp.status as OrderStatus) : undefined;
  const orders = await listOrdersForAdmin(status);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Orders & shipping</h1>
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/orders" className={`badge border ${!status ? "border-accent text-accent" : "border-border text-muted"}`}>All</Link>
        {Object.values(OrderStatus).map((s) => <Link key={s} href={`/admin/orders?status=${s}`} className={`badge border ${status === s ? "border-accent text-accent" : "border-border text-muted"}`}>{s}</Link>)}
      </nav>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">Created</th><th className="p-3">Status</th><th className="p-3">Item</th><th className="p-3">Customer</th><th className="p-3">Ship to</th><th className="p-3">Tracking</th><th className="p-3 text-right">Fee</th><th className="p-3"></th></tr></thead>
          <tbody className="divide-y divide-border">
            {orders.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted">No orders{status ? ` with status ${status}` : ""}.</td></tr>}
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="p-3 text-muted">{o.createdAt.toLocaleDateString("en-US")}</td>
                <td className="p-3"><span className="badge border border-border bg-surface-2">{o.status}</span></td>
                <td className="p-3">{o.vaultItem?.product.name ?? "—"}</td>
                <td className="p-3">{o.user.displayName}<br /><span className="text-xs text-muted">{o.user.email}</span></td>
                <td className="p-3 text-xs text-muted">{o.recipientName}, {o.city}, {o.state} {o.postalCode}</td>
                <td className="p-3 font-mono text-xs">{o.trackingNumber ? `${o.carrier ?? ""} ${o.trackingNumber}` : <span className="text-warning">needs tracking</span>}</td>
                <td className="p-3 text-right font-mono">{formatCents(o.shippingFeeCents)}</td>
                <td className="p-3 text-right"><Link href={`/admin/orders/${o.id}`} className="text-accent">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
