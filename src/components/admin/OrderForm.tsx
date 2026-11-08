"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { updateOrderAction } from "@/app/admin/actions";
import { Alert } from "@/components/ui/Alert";

export function OrderForm({ orderId, initial }: { orderId: string; initial: { status: OrderStatus; carrier: string; trackingNumber: string; adminNotes: string } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await updateOrderAction(orderId, v);
      setMsg(r.ok ? { kind: "success", text: "Order updated." } : { kind: "danger", text: r.error });
      router.refresh();
    });
  return (
    <div className="card grid gap-3 p-5 sm:grid-cols-2">
      <label className="block text-sm"><span className="label">Status</span>
        <select className="input" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as OrderStatus })}>
          {Object.values(OrderStatus).map((s) => <option key={s} value={s}>{s}</option>)}
        </select></label>
      <label className="block text-sm"><span className="label">Carrier</span><input className="input" placeholder="USPS, UPS, FedEx…" value={v.carrier} onChange={(e) => setV({ ...v, carrier: e.target.value })} /></label>
      <label className="block text-sm sm:col-span-2"><span className="label">Tracking number</span><input className="input font-mono" value={v.trackingNumber} onChange={(e) => setV({ ...v, trackingNumber: e.target.value })} /></label>
      <label className="block text-sm sm:col-span-2"><span className="label">Admin notes (private)</span><textarea className="input h-20" value={v.adminNotes} onChange={(e) => setV({ ...v, adminNotes: e.target.value })} /></label>
      <div className="sm:col-span-2 space-y-2">
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save order"}</button>
      </div>
    </div>
  );
}
