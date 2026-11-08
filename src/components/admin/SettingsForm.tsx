"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBlockedStateAction, removeBlockedStateAction, updateSettingsAction } from "@/app/admin/actions";
import { US_STATES } from "@/lib/us-states";
import { Alert } from "@/components/ui/Alert";

type Values = Record<string, string | number>;
interface Field { key: string; label: string; kind: "number" | "cents" | "select"; options?: string[]; help?: string }

export function SettingsForm({ initial, fields }: { initial: Values; fields: Field[] }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.key, f.kind === "cents" ? (Number(initial[f.key]) / 100).toFixed(2) : String(initial[f.key])])));
  const [msg, setMsg] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const payload: Record<string, unknown> = {};
      for (const f of fields) payload[f.key] = f.kind === "select" ? v[f.key] : f.kind === "cents" ? Math.round(Number(v[f.key]) * 100) : Number(v[f.key]);
      const r = await updateSettingsAction(payload);
      setMsg(r.ok ? { kind: "success", text: r.data!.changed.length ? `Updated: ${r.data!.changed.join(", ")}` : "No changes." } : { kind: "danger", text: r.error });
      router.refresh();
    });
  return (
    <div className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="label">{f.label}{f.kind === "cents" ? " ($)" : ""}</span>
            {f.kind === "select" ? (
              <select className="input" value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>{f.options!.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            ) : (
              <input className="input font-mono" inputMode="decimal" value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            )}
            {f.help && <span className="mt-1 block text-xs text-muted">{f.help}</span>}
          </label>
        ))}
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
    </div>
  );
}

export function BlockedStates({ blocked }: { blocked: { code: string; name: string; note: string | null }[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const blockedSet = new Set(blocked.map((b) => b.code));
  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-lg font-bold">Blocked states</h2>
      <p className="text-sm text-muted">Spins are refused for users whose stated state or detected location is in this list. Takes effect immediately.</p>
      <ul className="flex flex-wrap gap-2">
        {blocked.map((b) => (
          <li key={b.code} className="badge border border-danger/40 bg-danger/10 text-text">
            {b.name} ({b.code}){b.note && <span className="ml-1 text-muted">· {b.note}</span>}
            <button type="button" className="ml-2 text-muted hover:text-danger" disabled={pending} onClick={() => start(async () => { const r = await removeBlockedStateAction(b.code); setMsg(r.ok ? null : r.error); router.refresh(); })} aria-label={`Unblock ${b.name}`}>✕</button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-[14rem_1fr_auto]">
        <select className="input" value={code} onChange={(e) => setCode(e.target.value)} aria-label="State to block">
          <option value="">Add a state…</option>
          {US_STATES.filter((s) => !blockedSet.has(s.code)).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
        <input className="input" placeholder="Note (optional, e.g. statute reference)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" className="btn-secondary" disabled={pending || !code} onClick={() => start(async () => { const r = await addBlockedStateAction(code, note); setMsg(r.ok ? null : r.error); setCode(""); setNote(""); router.refresh(); })}>Block</button>
      </div>
      {msg && <Alert kind="danger">{msg}</Alert>}
    </div>
  );
}
