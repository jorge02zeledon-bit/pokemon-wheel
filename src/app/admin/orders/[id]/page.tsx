import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderForAdmin } from "@/server/admin/orders";
import { OrderForm } from "@/components/admin/OrderForm";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Admin · Order" };

export default async function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const o = await getOrderForAdmin(id);
  if (!o) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Order <span className="font-mono text-base text-muted">{o.id}</span></h1>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <div className="card p-5 text-sm">
            <h3 className="text-lg font-bold">Item</h3>
            <p className="mt-2 font-medium">{o.vaultItem?.product.name}</p>
            <p className="text-muted">Value {o.vaultItem ? formatCents(o.vaultItem.valueCents) : "—"} · won on {o.vaultItem?.spin.wheel.name} · {o.vaultItem?.spin.createdAt.toLocaleString("en-US")}</p>
            {o.vaultItem && <Link href={`/fair?spin=${o.vaultItem.spin.id}`} className="text-xs text-accent">Spin record</Link>}
          </div>
          <div className="card p-5 text-sm">
            <h3 className="text-lg font-bold">Ship to</h3>
            <address className="mt-2 not-italic">
              {o.recipientName}<br />{o.line1}<br />{o.line2 && <>{o.line2}<br /></>}{o.city}, {o.state} {o.postalCode}<br />{o.country}
            </address>
            <p className="mt-3 text-muted">Customer: <Link href={`/admin/users/${o.user.id}`} className="text-accent">{o.user.displayName}</Link> ({o.user.email}) · identity {o.user.identityStatus.toLowerCase()}</p>
            <p className="text-muted">Shipping fee charged: {formatCents(o.shippingFeeCents)} · requested {o.createdAt.toLocaleString("en-US")}</p>
          </div>
        </div>
        <OrderForm orderId={o.id} initial={{ status: o.status, carrier: o.carrier ?? "", trackingNumber: o.trackingNumber ?? "", adminNotes: o.adminNotes ?? "" }} />
      </div>
    </div>
  );
}
