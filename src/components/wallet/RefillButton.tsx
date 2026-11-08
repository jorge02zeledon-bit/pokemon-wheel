"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";

interface Status {
  available: boolean;
  refillCents: number;
  reason: "DISABLED" | "BALANCE_TOO_HIGH" | "COOLDOWN" | null;
  availableAt: string | null;
}

export function RefillButton({ status }: { status: Status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refill = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/demo/refill", { method: "POST" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message ?? "Refill not available");
      setMsg(`Added ${formatCents(body.grantedCents, { compact: true })} in demo credits.`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Refill not available");
    } finally {
      setBusy(false);
    }
  };

  const hint =
    status.reason === "BALANCE_TOO_HIGH"
      ? `Available once your demo balance drops below ${formatCents(status.refillCents, { compact: true })}.`
      : status.reason === "COOLDOWN" && status.availableAt
        ? `Next refill available ${new Date(status.availableAt).toLocaleString("en-US")}.`
        : null;

  return (
    <div className="space-y-2">
      <button type="button" className="btn-primary" onClick={refill} disabled={busy || !status.available}>
        {busy ? "Adding…" : `Refill ${formatCents(status.refillCents, { compact: true })} demo credits`}
      </button>
      {hint && !msg && <p className="text-xs text-muted">{hint}</p>}
      {msg && <p role="status" className="text-xs text-text">{msg}</p>}
    </div>
  );
}
