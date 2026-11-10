"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@/lib/us-states";
import { Alert } from "@/components/ui/Alert";

/**
 * Compact "set your state of residence" control. Used inline on wheel pages
 * when an account has no state yet, and on the account page.
 */
export function StatePicker({ current, compact = false, onSaved }: { current: string | null; compact?: boolean; onSaved?: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "danger"; text: string } | null>(null);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/account/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stateCode: code }) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.message ?? "Could not save");
      setMsg({ kind: "success", text: "State saved." });
      onSaved?.();
      router.refresh();
    } catch (e) {
      setMsg({ kind: "danger", text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? "flex flex-wrap items-center justify-center gap-2" : "space-y-2"}>
      <select className={`input ${compact ? "w-auto min-w-[14rem]" : ""}`} value={code} onChange={(e) => setCode(e.target.value)} aria-label="State of residence">
        <option value="" disabled>Select your state</option>
        {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
      </select>
      <button type="button" className="btn-primary" onClick={save} disabled={busy || !code || code === current}>{busy ? "Saving…" : "Save state"}</button>
      {msg && <div className="w-full"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
    </div>
  );
}
