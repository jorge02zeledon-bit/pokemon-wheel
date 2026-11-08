"use client";

import { useState } from "react";
import Link from "next/link";

export interface FairState {
  clientSeed: string;
  nextNonce: number;
  nextServerSeedHash: string;
}

/**
 * Shows the commitment for the user's next spin and lets them change their
 * client seed. The server seed hash is displayed BEFORE spinning so the user
 * can confirm afterwards that the revealed seed matches.
 */
export function FairPanel({ state, onChange }: { state: FairState; onChange: (s: FairState) => void }) {
  const [editing, setEditing] = useState(false);
  const [seed, setSeed] = useState(state.clientSeed);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/fair/client-seed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientSeed: seed }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message ?? "Could not save");
      onChange(body);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="card p-4 text-sm">
      <summary className="cursor-pointer font-semibold">
        Provably fair: next spin commitment <span className="ml-1 font-normal text-muted">(nonce #{state.nextNonce})</span>
      </summary>
      <dl className="mt-3 space-y-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Server seed hash (SHA-256), committed before you spin</dt>
          <dd className="break-all font-mono text-xs">{state.nextServerSeedHash}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Your client seed</dt>
          {editing ? (
            <dd className="mt-1 flex flex-wrap gap-2">
              <input className="input max-w-xs font-mono text-xs" value={seed} onChange={(e) => setSeed(e.target.value)} aria-label="Client seed" />
              <button type="button" className="btn-primary px-3 py-1.5" onClick={save} disabled={busy}>Save</button>
              <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => { setEditing(false); setSeed(state.clientSeed); }}>Cancel</button>
              {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
            </dd>
          ) : (
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <code className="font-mono text-xs">{state.clientSeed}</code>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(true)}>Change</button>
            </dd>
          )}
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">
        Result = HMAC-SHA256(server seed, &quot;client seed:nonce&quot;). After each spin the server seed is revealed and a new one is
        committed. <Link href="/fair" className="underline">How to verify →</Link>
      </p>
    </details>
  );
}
