"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustBalanceAction, setUserRoleAction } from "@/app/admin/actions";
import { parseDollarsToCents } from "@/lib/money";
import { Alert } from "@/components/ui/Alert";

export function UserActions({ userId, role, isSelf }: { userId: string; role: "USER" | "ADMIN"; isSelf: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [isDemo, setIsDemo] = useState(true);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const toggleRole = () =>
    start(async () => {
      const r = await setUserRoleAction(userId, role === "ADMIN" ? "USER" : "ADMIN");
      setMsg(r.ok ? { kind: "success", text: "Role updated." } : { kind: "danger", text: r.error });
      router.refresh();
    });

  const adjust = () => {
    let cents: number;
    try { cents = parseDollarsToCents(amount); } catch { return setMsg({ kind: "danger", text: "Enter a dollar amount like 25 or -9.95" }); }
    start(async () => {
      const r = await adjustBalanceAction(userId, cents, isDemo, reason);
      setMsg(r.ok ? { kind: "success", text: "Balance adjusted." } : { kind: "danger", text: r.error });
      if (r.ok) { setAmount(""); setReason(""); }
      router.refresh();
    });
  };

  return (
    <div className="card space-y-4 p-5 text-sm">
      <h3 className="text-lg font-bold">Actions</h3>
      <div className="flex items-center gap-3">
        <span>Role: <span className="badge border border-border bg-surface-2">{role}</span></span>
        <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={toggleRole} disabled={pending || isSelf} title={isSelf ? "You cannot change your own role" : undefined}>
          {role === "ADMIN" ? "Demote to user" : "Promote to admin"}
        </button>
      </div>
      <div className="space-y-2">
        <p className="label">Manual balance adjustment</p>
        <div className="grid gap-2 sm:grid-cols-[7rem_7rem_1fr_auto]">
          <input className="input font-mono" placeholder="+25.00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
          <select className="input" value={isDemo ? "demo" : "real"} onChange={(e) => setIsDemo(e.target.value === "demo")} aria-label="Balance">
            <option value="demo">Demo</option><option value="real">Real</option>
          </select>
          <input className="input" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
          <button type="button" className="btn-primary" onClick={adjust} disabled={pending || !amount || !reason}>Apply</button>
        </div>
        <p className="text-xs text-muted">Recorded as an ADJUSTMENT ledger entry and in the admin audit log. Negative amounts cannot overdraw.</p>
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
    </div>
  );
}
