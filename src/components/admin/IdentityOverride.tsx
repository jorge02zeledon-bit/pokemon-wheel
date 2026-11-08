"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setIdentityStatusAction } from "@/app/admin/actions";
import { Alert } from "@/components/ui/Alert";

export function IdentityOverride({ userId, status }: { userId: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (s: "APPROVED" | "REJECTED") =>
    start(async () => {
      const r = await setIdentityStatusAction(userId, s, reason);
      setMsg(r.ok ? `Identity set to ${s}.` : r.error);
      if (r.ok) setReason("");
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <p className="label">Identity verification override (current: {status})</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input className="input" placeholder="Reason (required, audited)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Identity reason" />
        <button type="button" className="btn-secondary" disabled={pending || !reason} onClick={() => set("APPROVED")}>Approve</button>
        <button type="button" className="btn-secondary text-danger" disabled={pending || !reason} onClick={() => set("REJECTED")}>Reject</button>
      </div>
      {msg && <Alert kind="info">{msg}</Alert>}
    </div>
  );
}
