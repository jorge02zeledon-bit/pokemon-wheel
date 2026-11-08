"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProductCategory } from "@prisma/client";
import { parseDollarsToCents } from "@/lib/money";
import { saveProductAction } from "@/app/admin/actions";
import { Alert } from "@/components/ui/Alert";

export interface ProductFormValues { id?: string; slug: string; name: string; category: ProductCategory; value: string; description: string; isActive: boolean; initialStock: string }

export function ProductForm({ initial }: { initial: ProductFormValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) => { setV((p) => ({ ...p, [k]: val })); setSaved(false); };

  const save = () => {
    setError(null);
    let valueCents: number;
    try { valueCents = parseDollarsToCents(v.value); } catch { return setError("Enter a valid dollar value"); }
    start(async () => {
      const r = await saveProductAction({ id: v.id, slug: v.slug, name: v.name, category: v.category, valueCents, description: v.description, isActive: v.isActive, initialStock: v.id ? undefined : Number(v.initialStock) || 0 });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      if (!v.id) router.replace(`/admin/products/${r.data!.id}`);
      router.refresh();
    });
  };

  return (
    <div className="card grid gap-4 p-5 sm:grid-cols-2">
      <label className="block text-sm sm:col-span-2"><span className="label">Name (text only, no logos)</span><input className="input" value={v.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label className="block text-sm"><span className="label">Slug</span><input className="input font-mono" value={v.slug} onChange={(e) => set("slug", e.target.value)} /></label>
      <label className="block text-sm"><span className="label">Category</span>
        <select className="input" value={v.category} onChange={(e) => set("category", e.target.value as ProductCategory)}>
          {Object.values(ProductCategory).map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
        </select></label>
      <label className="block text-sm"><span className="label">Listed value ($)</span><input className="input font-mono" inputMode="decimal" value={v.value} onChange={(e) => set("value", e.target.value)} /></label>
      {!v.id && <label className="block text-sm"><span className="label">Initial stock</span><input className="input font-mono" type="number" min={0} value={v.initialStock} onChange={(e) => set("initialStock", e.target.value)} /></label>}
      <label className="block text-sm sm:col-span-2"><span className="label">Description</span><textarea className="input h-20" value={v.description} onChange={(e) => set("description", e.target.value)} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active (inactive products pause any wheel that awards them)</label>
      <div className="sm:col-span-2 space-y-2">
        {error && <Alert kind="danger">{error}</Alert>}
        {saved && <Alert kind="success">Saved.</Alert>}
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save product"}</button>
      </div>
    </div>
  );
}
