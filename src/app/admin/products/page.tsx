import Link from "next/link";
import Image from "next/image";
import { listProductsForAdmin } from "@/server/admin/products";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Admin · Products" };

export default async function AdminProductsPage() {
  const products = await listProductsForAdmin();
  const low = products.filter((p) => p.stock < 2 && p.tiers.length > 0);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products & inventory</h1>
        <Link href="/admin/products/new" className="btn-primary px-3 py-1.5 text-sm">+ New product</Link>
      </div>
      {low.length > 0 && (
        <p className="rounded-xl border border-warning/50 bg-warning/10 px-4 py-2 text-sm">
          Low stock on {low.length} product{low.length === 1 ? "" : "s"} used by wheels: {low.map((p) => `${p.name} (${p.stock})`).join(", ")}. A wheel pauses when any prize hits 0.
        </p>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3 text-right">Value</th><th className="p-3 text-right">Stock</th><th className="p-3">Used in</th><th className="p-3"></th></tr></thead>
          <tbody className="divide-y divide-border">
            {products.map((p) => (
              <tr key={p.id} className={p.isActive ? "" : "opacity-50"}>
                <td className="p-3"><div className="flex items-center gap-3"><Image src={p.imageUrl ?? "/placeholder-product.svg"} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-lg border border-border object-cover" /><div><p className="font-medium">{p.name}</p><p className="font-mono text-xs text-muted">{p.slug}</p></div></div></td>
                <td className="p-3 text-muted">{p.category.replace(/_/g, " ")}</td>
                <td className="p-3 text-right font-mono">{formatCents(p.valueCents, { compact: true })}</td>
                <td className={`p-3 text-right font-mono ${p.stock < 1 ? "text-danger" : p.stock < 3 ? "text-warning" : ""}`}>{p.stock}</td>
                <td className="p-3 text-xs text-muted">{[...new Set(p.tiers.map((t) => t.tier.wheel.name))].join(", ") || "—"}</td>
                <td className="p-3 text-right"><Link href={`/admin/products/${p.id}`} className="text-accent">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
