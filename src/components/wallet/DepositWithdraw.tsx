"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseDollarsToCents, formatCents } from "@/lib/money";
import { Alert } from "@/components/ui/Alert";

/**
 * Deposit / withdraw forms. Rendered only in real-money mode; the server
 * enforces the same gate, identity verification and limits regardless.
 */
export function DepositWithdraw({ identityApproved, balanceCents }: { identityApproved: boolean; balanceCents: number }) {
  const router = useRouter();
  const [dep, setDep] = useState("");
  const [wd, setWd] = useState("");
  const [dest, setDest] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (url: string, body: unknown, ok: (b: { status: string; redirectUrl?: string | null }) => string) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.message ?? "Request failed");
      if (b.redirectUrl) { window.location.href = b.redirectUrl; return; }
      setMsg({ kind: b.status === "FAILED" ? "danger" : "success", text: ok(b) });
      setDep(""); setWd("");
      router.refresh();
    } catch (e) { setMsg({ kind: "danger", text: e instanceof Error ? e.message : "Request failed" }); } finally { setBusy(false); }
  };

  if (!identityApproved) {
    return <Alert kind="warning">Verify your identity on the <Link href="/account" className="underline">account page</Link> before depositing or withdrawing.</Alert>;
  }
  return (
    <div className="space-y-3">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <div className="flex gap-2">
        <input className="input font-mono" inputMode="decimal" placeholder="Deposit $" value={dep} onChange={(e) => setDep(e.target.value)} aria-label="Deposit amount" />
        <button type="button" className="btn-primary" disabled={busy || !dep} onClick={() => { try { call("/api/wallet/deposit", { amountCents: parseDollarsToCents(dep) }, (b) => (b.status === "SUCCEEDED" ? "Deposit received." : b.status === "PENDING" ? "Deposit pending." : "Deposit failed.")); } catch { setMsg({ kind: "danger", text: "Enter a valid amount" }); } }}>Deposit</button>
      </div>
      <div className="flex gap-2">
        <input className="input font-mono" inputMode="decimal" placeholder="Withdraw $" value={wd} onChange={(e) => setWd(e.target.value)} aria-label="Withdrawal amount" />
        <input className="input" placeholder="Payout destination" value={dest} onChange={(e) => setDest(e.target.value)} aria-label="Payout destination" />
        <button type="button" className="btn-secondary" disabled={busy || !wd} onClick={() => { try { call("/api/wallet/withdraw", { amountCents: parseDollarsToCents(wd), destination: { account: dest } }, () => "Withdrawal requested. Funds are held while it is processed."); } catch { setMsg({ kind: "danger", text: "Enter a valid amount" }); } }}>Withdraw</button>
      </div>
      <p className="text-xs text-muted">Available: {formatCents(balanceCents)}. Deposits $10–$5,000; withdrawals from $20. Deposit limits you set on your account page apply.</p>
    </div>
  );
}
