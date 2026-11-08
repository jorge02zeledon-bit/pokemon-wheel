"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { adjustStockAction, clearProductImageAction } from "@/app/admin/actions";
import { Alert } from "@/components/ui/Alert";

export function StockAdjust({ productId, stock }: { productId: string; stock: number }) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const r = await adjustStockAction(productId, Number(delta), reason);
      if (!r.ok) return setMsg({ kind: "danger", text: r.error });
      setMsg({ kind: "success", text: `Stock is now ${r.data!.stock}.` });
      setDelta(""); setReason("");
      router.refresh();
    });
  return (
    <div className="card space-y-3 p-5">
      <h3 className="text-lg font-bold">Inventory</h3>
      <p className="text-sm">On hand: <span className="font-mono text-2xl font-semibold">{stock}</span></p>
      <div className="grid gap-2 sm:grid-cols-[7rem_1fr_auto]">
        <input className="input font-mono" placeholder="+10 / -2" value={delta} onChange={(e) => setDelta(e.target.value)} aria-label="Stock change" />
        <input className="input" placeholder="Reason (received shipment, damaged, correction…)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
        <button type="button" className="btn-primary" onClick={submit} disabled={pending || !delta || !reason}>Apply</button>
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <p className="text-xs text-muted">Won units are reserved automatically by the spin engine. Every manual change is written to the admin audit log.</p>
    </div>
  );
}

export function ImageUpload({ productId, imageUrl }: { productId: string; imageUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const upload = async (file: File) => {
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("productId", productId);
      const r = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message ?? "Upload failed");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3 p-5">
      <h3 className="text-lg font-bold">Photo</h3>
      <div className="flex items-start gap-4">
        <Image src={imageUrl ?? "/placeholder-product.svg"} alt="" width={160} height={160} unoptimized className="h-40 w-40 rounded-xl border border-border object-cover" />
        <div className="space-y-2 text-sm">
          <p className="text-muted">Upload your own product photo (JPEG, PNG or WebP, up to 5 MB). Never use official artwork or logos you do not have rights to.</p>
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="block text-xs" />
          {imageUrl && (
            <button type="button" className="btn-ghost px-2 py-1 text-xs text-danger" disabled={pending} onClick={() => start(async () => { await clearProductImageAction(productId); router.refresh(); })}>
              Remove photo
            </button>
          )}
          {busy && <p className="text-xs text-muted">Uploading…</p>}
          {msg && <Alert kind="danger">{msg}</Alert>}
        </div>
      </div>
    </div>
  );
}
