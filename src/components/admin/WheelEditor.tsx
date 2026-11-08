"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Rarity } from "@prisma/client";
import { computeWheelEv } from "@/server/engine/ev";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { saveWheelAction } from "@/app/admin/actions";
import { EvPanel } from "./EvPanel";
import { Alert } from "@/components/ui/Alert";

export interface EditorProduct { id: string; name: string; valueCents: number; stock: number; isActive: boolean; category: string }
export interface EditorTier { id?: string; name: string; rarity: Rarity; oddsPercent: string; color: string; productIds: string[]; spins: number }
export interface EditorWheel {
  id?: string; slug: string; name: string; tagline: string; description: string; spinPrice: string; sortOrder: number;
  isActive: boolean; guaranteedFloor: boolean; accentColor: string; tiers: EditorTier[];
}

const TIER_DEFAULT_COLORS: Record<Rarity, string> = { COMMON: "#64748b", UNCOMMON: "#22d3ee", RARE: "#a78bfa", CHASE: "#fbbf24" };

/**
 * Wheel + tiers editor with a live EV/RTP panel. Odds are typed as percentages
 * and converted to basis points on save; the save is rejected unless they
 * total exactly 100%.
 */
export function WheelEditor({ initial, products, rtpRange }: { initial: EditorWheel; products: EditorProduct[]; rtpRange: { min: number; max: number } }) {
  const router = useRouter();
  const [w, setW] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const toBps = (pct: string) => Math.round((Number(pct) || 0) * 100);
  const priceCents = (() => { try { return parseDollarsToCents(w.spinPrice || "0"); } catch { return 0; } })();

  const ev = useMemo(
    () =>
      computeWheelEv(
        {
          spinPriceCents: priceCents,
          guaranteedFloor: w.guaranteedFloor,
          tiers: w.tiers.map((t) => ({ name: t.name, oddsBps: toBps(t.oddsPercent), products: t.productIds.map((id) => productById.get(id)).filter((p): p is EditorProduct => !!p) })),
        },
        { rtpWarnMinPercent: rtpRange.min, rtpWarnMaxPercent: rtpRange.max },
      ),
    [w, priceCents, productById, rtpRange],
  );

  const set = <K extends keyof EditorWheel>(k: K, v: EditorWheel[K]) => { setW((p) => ({ ...p, [k]: v })); setSaved(false); };
  const setTier = (i: number, patch: Partial<EditorTier>) => set("tiers", w.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const addTier = () => set("tiers", [...w.tiers, { name: "New tier", rarity: "COMMON", oddsPercent: "0", color: TIER_DEFAULT_COLORS.COMMON, productIds: [], spins: 0 }]);
  const removeTier = (i: number) => set("tiers", w.tiers.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= w.tiers.length) return;
    const arr = [...w.tiers]; [arr[i], arr[j]] = [arr[j], arr[i]]; set("tiers", arr);
  };

  const save = () => {
    setError(null);
    start(async () => {
      const r = await saveWheelAction({
        id: w.id, slug: w.slug, name: w.name, tagline: w.tagline, description: w.description, spinPriceCents: priceCents, sortOrder: Number(w.sortOrder) || 0,
        isActive: w.isActive, guaranteedFloor: w.guaranteedFloor, accentColor: w.accentColor,
        tiers: w.tiers.map((t) => ({ id: t.id, name: t.name, rarity: t.rarity, oddsBps: toBps(t.oddsPercent), color: t.color, productIds: t.productIds })),
      });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      if (!w.id) router.replace(`/admin/wheels/${r.data!.id}`);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2"><span className="label">Name</span><input className="input" value={w.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Slug (URL)</span><input className="input font-mono" value={w.slug} onChange={(e) => set("slug", e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Spin price ($)</span><input className="input font-mono" inputMode="decimal" value={w.spinPrice} onChange={(e) => set("spinPrice", e.target.value)} /></label>
          <label className="block text-sm sm:col-span-2"><span className="label">Tagline</span><input className="input" value={w.tagline} onChange={(e) => set("tagline", e.target.value)} /></label>
          <label className="block text-sm sm:col-span-2"><span className="label">Description</span><textarea className="input h-20" value={w.description} onChange={(e) => set("description", e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Accent colour</span><span className="flex gap-2"><input type="color" value={w.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-10 w-12 rounded-lg border border-border bg-transparent" aria-label="Accent colour picker" /><input className="input font-mono" value={w.accentColor} onChange={(e) => set("accentColor", e.target.value)} /></span></label>
          <label className="block text-sm"><span className="label">Sort order</span><input className="input font-mono" type="number" value={w.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={w.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active (visible and spinnable)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={w.guaranteedFloor} onChange={(e) => set("guaranteedFloor", e.target.checked)} /> Guaranteed floor (lowest prize ≥ spin price)</label>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Tiers</h3>
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={addTier}>+ Add tier</button>
          </div>
          {w.tiers.map((t, i) => {
            const picked = t.productIds.map((id) => productById.get(id)).filter((p): p is EditorProduct => !!p);
            const avg = picked.length ? picked.reduce((a, p) => a + p.valueCents, 0) / picked.length : 0;
            return (
              <div key={t.id ?? `new-${i}`} className="card space-y-3 p-4" style={{ borderLeft: `4px solid ${t.color}` }}>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block min-w-[12rem] flex-1 text-sm"><span className="label">Tier name</span><input className="input" value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} /></label>
                  <label className="block w-36 text-sm"><span className="label">Rarity</span>
                    <select className="input" value={t.rarity} onChange={(e) => setTier(i, { rarity: e.target.value as Rarity, color: TIER_DEFAULT_COLORS[e.target.value as Rarity] })}>
                      {(["COMMON", "UNCOMMON", "RARE", "CHASE"] as Rarity[]).map((r) => <option key={r} value={r}>{r}</option>)}
                    </select></label>
                  <label className="block w-24 text-sm"><span className="label">Odds %</span><input className="input font-mono" inputMode="decimal" value={t.oddsPercent} onChange={(e) => setTier(i, { oddsPercent: e.target.value })} /></label>
                  <label className="block text-sm"><span className="label">Colour</span><input type="color" value={t.color} onChange={(e) => setTier(i, { color: e.target.value })} className="block h-10 w-12 rounded-lg border border-border bg-transparent" aria-label="Tier colour" /></label>
                  <div className="flex items-center gap-1 pb-1 text-xs">
                    <button type="button" className="btn-ghost px-2" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button type="button" className="btn-ghost px-2" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                    <button type="button" className="btn-ghost px-2 text-danger" onClick={() => removeTier(i)} disabled={t.spins > 0} title={t.spins > 0 ? `Awarded ${t.spins} times; set odds to 0% to retire` : "Remove tier"}>✕</button>
                  </div>
                </div>
                <div>
                  <p className="label">Products ({picked.length}) · avg value {formatCents(Math.round(avg))} · one awarded at random</p>
                  <ProductPicker products={products} selected={t.productIds} onChange={(ids) => setTier(i, { productIds: ids })} />
                </div>
              </div>
            );
          })}
        </section>

        {error && <Alert kind="danger">{error}</Alert>}
        {saved && <Alert kind="success">Saved.</Alert>}
        <div className="flex gap-3">
          <button type="button" className="btn-primary" onClick={save} disabled={pending || !ev.valid}>{pending ? "Saving…" : "Save wheel"}</button>
          {!ev.valid && <span className="self-center text-xs text-danger">Fix the errors above before saving.</span>}
        </div>
      </div>
      <div className="xl:sticky xl:top-24 xl:h-fit">
        <EvPanel ev={ev} rtpRange={rtpRange} />
      </div>
    </div>
  );
}

function ProductPicker({ products, selected, onChange }: { products: EditorProduct[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const sel = new Set(selected);
  const shown = products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {selected.map((id) => {
          const p = products.find((x) => x.id === id);
          return (
            <span key={id} className="badge border border-border bg-surface-2">
              {p?.name ?? id} <span className="ml-1 font-mono text-muted">{p ? formatCents(p.valueCents, { compact: true }) : ""}</span>
              {p && p.stock < 1 && <span className="ml-1 text-danger">· out of stock</span>}
              <button type="button" className="ml-1 text-muted hover:text-danger" onClick={() => onChange(selected.filter((x) => x !== id))} aria-label={`Remove ${p?.name}`}>✕</button>
            </span>
          );
        })}
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-accent">Add products</summary>
        <input className="input mt-2 text-xs" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs">
          {shown.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-surface-2">
                <input type="checkbox" checked={sel.has(p.id)} onChange={(e) => onChange(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))} />
                <span className="flex-1">{p.name}</span>
                <span className="font-mono text-muted">{formatCents(p.valueCents, { compact: true })} · {p.stock} in stock</span>
              </label>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
