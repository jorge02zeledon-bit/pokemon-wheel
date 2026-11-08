"use client";

import { useEffect, useState } from "react";
import { fairMessage, hmacSha256HexWeb, rollsFromHash, sha256HexWeb } from "@/lib/fair-core";
import { selectIndex, selectTier } from "@/server/engine/odds";
import { formatBps, formatCents } from "@/lib/money";
import { Alert } from "@/components/ui/Alert";

/**
 * Client-side spin verifier. Everything is computed in the browser with Web
 * Crypto; a second "Cross-check on server" button hits the public API with the
 * same inputs. Pre-fill with ?spin=<id> (owner or admin only).
 */
interface SnapshotTier { id: string; name: string; rarity: "COMMON" | "UNCOMMON" | "RARE" | "CHASE"; oddsBps: number; products: { id: string; name: string; valueCents: number }[] }
interface Snapshot { version: 1; wheel: { name: string; spinPriceCents: number }; tiers: SnapshotTier[] }

interface Fields { serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: string; snapshot: string }
interface Outcome { seedHashMatches: boolean; resultHash: string; tierRoll: number; productRoll: number; tier: SnapshotTier; product: SnapshotTier["products"][number] }

export function Verifier({ spinId }: { spinId?: string }) {
  const [f, setF] = useState<Fields>({ serverSeed: "", serverSeedHash: "", clientSeed: "", nonce: "", snapshot: "" });
  const [recorded, setRecorded] = useState<{ tierId: string; productId: string; resultHash: string } | null>(null);
  const [out, setOut] = useState<Outcome | null>(null);
  const [serverOut, setServerOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !!spinId);

  useEffect(() => {
    if (!spinId) return;
    fetch(`/api/spins/${spinId}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.message ?? "Could not load spin");
        const s = body.spin;
        setF({ serverSeed: s.serverSeed, serverSeedHash: s.serverSeedHash, clientSeed: s.clientSeed, nonce: String(s.nonce), snapshot: JSON.stringify(s.oddsSnapshot, null, 2) });
        setRecorded({ tierId: s.tierId, productId: s.productId, resultHash: s.resultHash });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [spinId]);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const verify = async () => {
    setError(null);
    setOut(null);
    setServerOut(null);
    try {
      const snapshot = JSON.parse(f.snapshot) as Snapshot;
      const nonce = Number(f.nonce);
      if (!Number.isInteger(nonce) || nonce < 0) throw new Error("Nonce must be a non-negative integer");
      const seedHashMatches = (await sha256HexWeb(f.serverSeed)) === f.serverSeedHash.toLowerCase();
      const resultHash = await hmacSha256HexWeb(f.serverSeed, fairMessage(f.clientSeed, nonce));
      const rolls = rollsFromHash(resultHash);
      const tier = selectTier(snapshot.tiers, rolls.tierRoll);
      const product = tier.products[selectIndex(rolls.productRoll, tier.products.length)];
      setOut({ seedHashMatches, resultHash, tierRoll: rolls.tierRoll, productRoll: rolls.productRoll, tier, product });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify");
    }
  };

  const crossCheck = async () => {
    try {
      const r = await fetch("/api/fair/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverSeed: f.serverSeed, serverSeedHash: f.serverSeedHash, clientSeed: f.clientSeed, nonce: Number(f.nonce), snapshot: JSON.parse(f.snapshot) }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message ?? "Server verification failed");
      const same = out && body.resultHash === out.resultHash && body.product.id === out.product.id;
      setServerOut(`Server says: ${body.tier.name} → ${body.product.name}${same ? " (matches your browser)" : ""}`);
    } catch (e) {
      setServerOut(e instanceof Error ? e.message : "Server verification failed");
    }
  };

  const okAll = out && out.seedHashMatches && (!recorded || (recorded.tierId === out.tier.id && recorded.productId === out.product.id && recorded.resultHash === out.resultHash));

  return (
    <div className="space-y-4">
      {loading && <p className="text-sm text-muted">Loading spin…</p>}
      {error && <Alert kind="danger">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="label">Server seed (revealed after the spin)</span><input className="input font-mono text-xs" value={f.serverSeed} onChange={set("serverSeed")} /></label>
        <label className="block text-sm"><span className="label">Server seed hash (shown before the spin)</span><input className="input font-mono text-xs" value={f.serverSeedHash} onChange={set("serverSeedHash")} /></label>
        <label className="block text-sm"><span className="label">Client seed</span><input className="input font-mono text-xs" value={f.clientSeed} onChange={set("clientSeed")} /></label>
        <label className="block text-sm"><span className="label">Nonce</span><input className="input font-mono text-xs" inputMode="numeric" value={f.nonce} onChange={set("nonce")} /></label>
      </div>
      <label className="block text-sm"><span className="label">Odds snapshot (JSON stored with the spin)</span><textarea className="input h-40 font-mono text-xs" value={f.snapshot} onChange={set("snapshot")} /></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={verify}>Verify in my browser</button>
        <button type="button" className="btn-secondary" onClick={crossCheck} disabled={!out}>Cross-check on server</button>
      </div>

      {out && (
        <div className={`card space-y-2 p-4 text-sm ${okAll ? "border-success/50" : "border-danger/50"}`}>
          <p className="font-semibold">{okAll ? "✓ Verified" : "✗ Mismatch"}</p>
          <p>Seed commitment: {out.seedHashMatches ? <span className="text-success">sha256(server seed) matches the hash shown before the spin</span> : <span className="text-danger">hash does NOT match</span>}</p>
          <p className="break-all">Result hash: <code className="font-mono text-xs">{out.resultHash}</code></p>
          <p>Tier roll: <code className="font-mono">{out.tierRoll}</code> of 10,000 → <strong>{out.tier.name}</strong> ({formatBps(out.tier.oddsBps)})</p>
          <p>Product roll: <code className="font-mono">{out.productRoll}</code> mod {out.tier.products.length} → <strong>{out.product.name}</strong> ({formatCents(out.product.valueCents, { compact: true })})</p>
          {recorded && (
            <p>
              Recorded outcome:{" "}
              {recorded.tierId === out.tier.id && recorded.productId === out.product.id ? (
                <span className="text-success">matches</span>
              ) : (
                <span className="text-danger">does not match the recorded tier/product</span>
              )}
            </p>
          )}
          {serverOut && <p className="text-muted">{serverOut}</p>}
        </div>
      )}
    </div>
  );
}
