"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SpinResult } from "@/server/engine/spin";
import type { RecentWin } from "@/server/wheels/recent-wins";
import { formatCents } from "@/lib/money";
import { SpinWheel, type SpinWheelHandle, type WheelTier } from "./SpinWheel";
import { WinReveal } from "./WinReveal";
import { RecentWins } from "./RecentWins";
import { FairPanel, type FairState } from "./FairPanel";
import { Alert } from "@/components/ui/Alert";
import { SessionSpend } from "./SessionSpend";

export interface WheelPlayProps {
  wheel: { slug: string; name: string; spinPriceCents: number; accentColor: string; tiers: WheelTier[] };
  stocked: boolean;
  isDemo: boolean;
  viewer: null | {
    balanceCents: number;
    fair: FairState;
    blocker: { message: string } | null;
  };
  recentWins: RecentWin[];
}

type Status = "idle" | "spinning" | "revealed";

/**
 * Orchestrates one wheel page: asks the server for a result, drives the
 * animation to that result, then reveals it. The client never computes or
 * influences the outcome.
 */
export function WheelPlay({ wheel, stocked, isDemo, viewer, recentWins }: WheelPlayProps) {
  const router = useRouter();
  const wheelRef = useRef<SpinWheelHandle>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [balance, setBalance] = useState(viewer?.balanceCents ?? 0);
  const [fair, setFair] = useState<FairState | null>(viewer?.fair ?? null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushed, setPushed] = useState<RecentWin | null>(null);
  const [spinCount, setSpinCount] = useState(0);

  const canAfford = balance >= wheel.spinPriceCents;
  const disabledReason = !viewer
    ? null
    : viewer.blocker
      ? viewer.blocker.message
      : !stocked
        ? "This wheel is paused until every prize is back in stock."
        : !canAfford
          ? `You need ${formatCents(wheel.spinPriceCents, { compact: true })} to spin.`
          : null;

  const spin = useCallback(async () => {
    if (!viewer || status !== "idle" || disabledReason) return;
    setError(null);
    setStatus("spinning");
    wheelRef.current?.startSpinning();
    const started = performance.now();
    try {
      const r = await fetch("/api/spins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wheelSlug: wheel.slug }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message ?? "Spin failed");
      const res = body as SpinResult;
      // Let the wheel spin at least briefly so the result never "snaps".
      const minWait = 700 - (performance.now() - started);
      if (minWait > 0) await new Promise((res) => setTimeout(res, minWait));
      await wheelRef.current?.settleOn(res.tier.id);
      setBalance(res.balanceAfterCents);
      setFair((f) => (f ? { clientSeed: res.fair.clientSeed, nextNonce: res.fair.nonce + 1, nextServerSeedHash: res.fair.nextServerSeedHash } : f));
      setResult(res);
      setPushed({
        id: res.spinId,
        player: "You",
        tierName: res.tier.name,
        rarity: res.tier.rarity,
        tierColor: res.tier.color,
        productName: res.product.name,
        valueCents: res.product.valueCents,
        wheelSlug: wheel.slug,
        wheelName: wheel.name,
        isDemo: res.isDemo,
        createdAt: new Date(res.createdAt).toISOString(),
      });
      setStatus("revealed");
      setSpinCount((n) => n + 1);
      router.refresh(); // updates the server-rendered header balance
    } catch (e) {
      await wheelRef.current?.abort();
      setError(e instanceof Error ? e.message : "Spin failed");
      setStatus("idle");
      router.refresh(); // balance/stock may have changed server-side
    }
  }, [viewer, status, disabledReason, wheel.slug, wheel.name, router]);

  const close = useCallback(() => {
    setResult(null);
    setStatus("idle");
  }, []);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <SpinWheel
          ref={wheelRef}
          tiers={wheel.tiers}
          accentColor={wheel.accentColor}
          centerLabel={formatCents(wheel.spinPriceCents, { compact: true })}
        />

        <div className="card flex flex-col items-center gap-3 p-5 text-center">
          {viewer ? (
            <>
              <button
                type="button"
                className="btn-primary w-full max-w-xs py-3 text-base"
                style={{ background: wheel.accentColor }}
                onClick={spin}
                disabled={status !== "idle" || !!disabledReason}
                aria-busy={status === "spinning"}
              >
                {status === "spinning" ? "Spinning…" : `Spin for ${formatCents(wheel.spinPriceCents, { compact: true })}`}
              </button>
              <p className="text-sm text-muted">
                {isDemo && <span className="mr-1 rounded bg-warning/20 px-1.5 py-0.5 text-xs font-semibold text-warning">DEMO</span>}
                Balance: <span className="font-mono text-text">{formatCents(balance)}</span>
                {isDemo && !canAfford && (
                  <>
                    {" · "}
                    <Link href="/wallet" className="underline">Refill demo credits</Link>
                  </>
                )}
              </p>
              <SessionSpend refreshKey={spinCount} />
              {disabledReason && <Alert kind="warning">{disabledReason}</Alert>}
              {error && <Alert kind="danger">{error}</Alert>}
            </>
          ) : (
            <>
              <Link href={`/login?callbackUrl=/wheels/${wheel.slug}`} className="btn-primary w-full max-w-xs py-3 text-base" style={{ background: wheel.accentColor }}>
                Log in to spin
              </Link>
              <p className="text-sm text-muted">
                New here? <Link href="/signup" className="underline">Create an account</Link>
                {isDemo && " and get free demo credits."}
              </p>
            </>
          )}
        </div>

        {fair && <FairPanel state={fair} onChange={setFair} />}
      </div>

      <aside className="card h-fit p-5">
        <h2 className="mb-3 text-lg font-bold">Recent wins</h2>
        <RecentWins wheelSlug={wheel.slug} initial={recentWins} pushed={pushed} />
      </aside>

      {result && <WinReveal result={result} onClose={close} onSpinAgain={close} />}
    </div>
  );
}
