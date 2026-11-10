"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@/lib/us-states";
import { Alert } from "@/components/ui/Alert";

export function ProfileForm({ displayName, stateCode }: { displayName: string | null; stateCode: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(displayName ?? "");
  const [code, setCode] = useState(stateCode ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const dirty = name !== (displayName ?? "") || code !== (stateCode ?? "");

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body: Record<string, string> = {};
      if (name !== (displayName ?? "")) body.displayName = name;
      if (code !== (stateCode ?? "")) body.stateCode = code;
      const r = await fetch("/api/account/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.message ?? "Could not save");
      setMsg({ kind: "success", text: "Profile saved." });
      router.refresh();
    } catch (e) {
      setMsg({ kind: "danger", text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="label">Display name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block text-sm"><span className="label">State of residence</span>
          <select className="input" value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="" disabled>Select your state</option>
            {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
          {!stateCode && <span className="mt-1 block text-xs text-warning">Required before you can spin.</span>}
        </label>
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <button type="button" className="btn-primary" onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save profile"}</button>
    </div>
  );
}
