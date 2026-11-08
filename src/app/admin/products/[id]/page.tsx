import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductForAdmin } from "@/server/admin/products";
import { ProductForm } from "@/components/admin/ProductForm";
import { ImageUpload, StockAdjust } from "@/components/admin/StockAndImage";

export const metadata = { title: "Admin · Edit product" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const p = await getProductForAdmin(id);
  if (!p) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit: {p.name}</h1>
      <div className="grid gap-6 xl:grid-cols-2">
        <ProductForm initial={{ id: p.id, slug: p.slug, name: p.name, category: p.category, value: (p.valueCents / 100).toFixed(2), description: p.description ?? "", isActive: p.isActive, initialStock: "0" }} />
        <div className="space-y-6">
          <StockAdjust productId={p.id} stock={p.stock} />
          <ImageUpload productId={p.id} imageUrl={p.imageUrl} />
          <div className="card p-5 text-sm">
            <h3 className="text-lg font-bold">Used in</h3>
            {p.tiers.length === 0 ? <p className="mt-2 text-muted">Not on any wheel.</p> : (
              <ul className="mt-2 space-y-1">{p.tiers.map((t) => <li key={t.tierId}><Link href={`/admin/wheels/${t.tier.wheel.id}`} className="text-accent">{t.tier.wheel.name}</Link> · {t.tier.name} ({t.tier.oddsBps / 100}%)</li>)}</ul>
            )}
            <p className="mt-3 text-xs text-muted">Awarded {p._count.spins} time{p._count.spins === 1 ? "" : "s"}.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
