"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";

type Status = "NOT_STARTED" | "PENDING" | "APPROVED" | "REJECTED";

/**
 * Identity verification status + start button. While PENDING it polls the
 * status endpoint, which asks the provider (the mock auto-approves).
 */
export function IdentityCard({ initialStatus, realMoney }: { initialStatus: Status; realMoney: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "PENDING") return;
    let alive = true;
    const poll = async () => {
      const r = await fetch("/api/identity/status", { cache: "no-store" });
      if (!r.ok || !alive) return;
      const b = await r.json();
      if (b.status !== status) { setStatus(b.status); setReason(b.reason); router.refresh(); }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [status, router]);

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/identity/start", { method: "POST" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.message ?? "Could not start verification");
      if (b.redirectUrl) { window.location.href = b.redirectUrl; return; }
      setStatus(b.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start verification");
    } finally {
      setBusy(false);
    }
  };

  const badge = { NOT_STARTED: "bg-surface-2 text-muted", PENDING: "bg-warning/20 text-warning", APPROVED: "bg-success/20 text-success", REJECTED: "bg-danger/20 text-danger" }[status];
  return (
    <section className="card space-y-3 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Identity verification</h2>
        <span className={`badge ${badge}`}>{status.replace("_", " ")}</span>
      </div>
      <p className="text-sm text-muted">
        Required before any real-money deposit or withdrawal. {realMoney ? "" : "The site is in demo mode, so you can try the flow now but no payments are possible."}
      </p>
      {status === "PENDING" && <Alert kind="info">Checking your documents… this page updates automatically.</Alert>}
      {status === "REJECTED" && <Alert kind="danger">Verification was not successful{reason ? `: ${reason}` : ""}. You can try again.</Alert>}
      {status === "APPROVED" && <Alert kind="success">Your identity is verified.</Alert>}
      {error && <Alert kind="danger">{error}</Alert>}
      {(status === "NOT_STARTED" || status === "REJECTED") && (
        <button type="button" className="btn-primary" onClick={start} disabled={busy}>{busy ? "Starting…" : "Verify my identity"}</button>
      )}
    </section>
  );
}
