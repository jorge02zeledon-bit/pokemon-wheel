"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { Alert } from "@/components/ui/Alert";

type LimitKey = "dailyDepositCents" | "weeklyDepositCents" | "monthlyDepositCents" | "dailySpendCents";
interface Props {
  limits: Record<LimitKey, number | null>;
  pending: Partial<Record<LimitKey, number | null>>;
  pendingEffectiveAt: string | null;
  coolingHours: number;
  cooldownUntil: string | null;
  exclusion: { duration: string; endsAt: string | null } | null;
}

const LIMIT_LABELS: [LimitKey, string][] = [
  ["dailyDepositCents", "Daily deposit limit"],
  ["weeklyDepositCents", "Weekly deposit limit"],
  ["monthlyDepositCents", "Monthly deposit limit"],
  ["dailySpendCents", "Daily spend limit (spins)"],
];

export function ResponsiblePlay(p: Props) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<LimitKey, string>>(Object.fromEntries(LIMIT_LABELS.map(([k]) => [k, p.limits[k] === null ? "" : (p.limits[k]! / 100).toFixed(2)])) as Record<LimitKey, string>);
  const [msg, setMsg] = useState<{ kind: "success" | "danger" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [duration, setDuration] = useState<"DAYS_30" | "MONTHS_6" | "PERMANENT">("DAYS_30");

  const post = async (url: string, body: unknown) => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const b = await r.json();
    if (!r.ok) throw new Error(b.message ?? "Request failed");
    return b;
  };

  const saveLimits = async () => {
    setBusy(true); setMsg(null);
    try {
      const body: Partial<Record<LimitKey, number | null>> = {};
      for (const [k] of LIMIT_LABELS) body[k] = vals[k].trim() === "" ? null : parseDollarsToCents(vals[k]);
      const r = await post("/api/account/limits", body);
      const pendingKeys = Object.keys(r.pending ?? {});
      setMsg(pendingKeys.length
        ? { kind: "warning", text: `Saved. Increases or removals take effect ${new Date(r.pendingEffectiveAt).toLocaleString("en-US")} (${p.coolingHours}h cooling-off).` }
        : { kind: "success", text: "Limits saved and in effect now." });
      router.refresh();
    } catch (e) { setMsg({ kind: "danger", text: e instanceof Error ? e.message : "Could not save" }); } finally { setBusy(false); }
  };

  const takeBreak = async (hours: number) => {
    if (!window.confirm(`Block spinning for ${hours / 24} day(s)? This cannot be shortened.`)) return;
    setBusy(true); setMsg(null);
    try { await post("/api/account/break", { hours }); setMsg({ kind: "success", text: "Break started. Spinning is paused." }); router.refresh(); }
    catch (e) { setMsg({ kind: "danger", text: e instanceof Error ? e.message : "Could not start break" }); } finally { setBusy(false); }
  };

  const exclude = async () => {
    setBusy(true); setMsg(null);
    try { await post("/api/account/self-exclude", { duration, confirmation: confirm }); setMsg({ kind: "success", text: "Self-exclusion is now in force." }); setConfirm(""); router.refresh(); }
    catch (e) { setMsg({ kind: "danger", text: e instanceof Error ? e.message : "Could not self-exclude" }); } finally { setBusy(false); }
  };

  const onBreak = p.cooldownUntil && new Date(p.cooldownUntil) > new Date();
  return (
    <section id="responsible-play" className="card space-y-6 p-6">
      <div>
        <h2 className="text-lg font-bold">Responsible play</h2>
        <p className="text-sm text-muted">Tools to keep play within your limits. If you need help, call or text 1-800-GAMBLER.</p>
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <div className="space-y-3">
        <h3 className="font-semibold">Limits</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {LIMIT_LABELS.map(([k, label]) => (
            <label key={k} className="block text-sm">
              <span className="label">{label} ($)</span>
              <input className="input font-mono" inputMode="decimal" placeholder="No limit" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
              {p.pending[k] !== undefined && (
                <span className="mt-1 block text-xs text-warning">
                  Pending: {p.pending[k] === null ? "remove limit" : formatCents(p.pending[k]!)} on {p.pendingEffectiveAt ? new Date(p.pendingEffectiveAt).toLocaleString("en-US") : ""}
                </span>
              )}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">Lowering a limit applies immediately. Raising or removing one takes effect after {p.coolingHours} hours.</p>
        <button type="button" className="btn-primary" onClick={saveLimits} disabled={busy}>Save limits</button>
      </div>

      <div className="space-y-2 border-t border-border pt-5">
        <h3 className="font-semibold">Take a break</h3>
        {onBreak ? (
          <p className="text-sm text-warning">Spinning is paused until {new Date(p.cooldownUntil!).toLocaleString("en-US")}.</p>
        ) : (
          <p className="text-sm text-muted">Pause spinning for a fixed period. Breaks cannot be ended early.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {[24, 72, 168].map((h) => <button key={h} type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={busy} onClick={() => takeBreak(h)}>{h / 24} day{h > 24 ? "s" : ""}</button>)}
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-5">
        <h3 className="font-semibold text-danger">Self-exclusion</h3>
        {p.exclusion ? (
          <Alert kind="danger">
            You are self-excluded ({p.exclusion.duration.replace("_", " ").toLowerCase()}){p.exclusion.endsAt ? ` until ${new Date(p.exclusion.endsAt).toLocaleDateString("en-US")}` : " permanently"}. Spinning and deposits are blocked. This cannot be reversed early.
          </Alert>
        ) : (
          <>
            <p className="text-sm text-muted">Block spinning and deposits for 30 days, 6 months or permanently. You keep access to your vault and withdrawals. <strong className="text-text">This cannot be undone early by you or by support.</strong></p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block text-sm"><span className="label">Duration</span>
                <select className="input" value={duration} onChange={(e) => setDuration(e.target.value as typeof duration)}>
                  <option value="DAYS_30">30 days</option><option value="MONTHS_6">6 months</option><option value="PERMANENT">Permanent</option>
                </select></label>
              <label className="block text-sm"><span className="label">Type EXCLUDE to confirm</span><input className="input font-mono" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
              <button type="button" className="btn bg-danger text-bg" disabled={busy || confirm !== "EXCLUDE"} onClick={exclude}>Self-exclude</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
