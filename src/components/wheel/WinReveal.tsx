"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { SpinResult } from "@/server/engine/spin";
import { formatBps, formatCents } from "@/lib/money";
import { TierBadge } from "./TierBadge";
import { Confetti } from "./Confetti";

const TIER_CONFETTI: Record<string, string[]> = {
  RARE: ["#a78bfa", "#c4b5fd", "#22d3ee", "#e6e9f2"],
  CHASE: ["#fbbf24", "#fde68a", "#f472b6", "#22d3ee", "#e6e9f2"],
};

/** Modal shown once the wheel has stopped. Confetti for rare and chase wins. */
export function WinReveal({ result, onClose, onSpinAgain }: { result: SpinResult; onClose: () => void; onSpinAgain: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const confetti = TIER_CONFETTI[result.tier.rarity];

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const big = result.tier.rarity === "CHASE";
  return (
    <>
      {confetti && <Confetti colors={confetti} />}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="win-title"
          className="card w-full max-w-md overflow-hidden p-0 text-center"
          style={{ boxShadow: `0 0 80px -20px ${result.tier.color}` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">{big ? "Chase prize!" : "You won"}</p>
            <h2 id="win-title" className={`mt-2 font-black ${big ? "text-3xl text-tier-chase" : "text-2xl"}`}>
              {result.product.name}
            </h2>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm">
              <TierBadge rarity={result.tier.rarity} name={result.tier.name} />
              <span className="text-muted">{formatBps(result.tier.oddsBps)} odds</span>
              <span className="font-mono font-semibold">{formatCents(result.product.valueCents, { compact: true })}</span>
            </div>
          </div>
          <div className="mx-auto my-5 aspect-square w-40 overflow-hidden rounded-2xl border border-border bg-bg/60">
            <Image
              src={result.product.imageUrl ?? "/placeholder-product.svg"}
              alt=""
              width={320}
              height={320}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
          <p className="px-6 text-sm text-muted">
            It&apos;s in your vault. You have until{" "}
            <span className="text-text">{result.vault.expiresAt ? new Date(result.vault.expiresAt).toLocaleDateString("en-US") : "—"}</span>{" "}
            to ship it or sell it back.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border bg-bg/40 p-4">
            <button ref={closeRef} type="button" className="btn-primary" onClick={onSpinAgain}>
              Spin again
            </button>
            <Link href="/vault" className="btn-secondary">
              View vault
            </Link>
            <Link href={`/fair?spin=${result.spinId}`} className="col-span-2 text-xs text-muted underline-offset-2 hover:text-text hover:underline">
              Verify this spin (server seed revealed)
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
