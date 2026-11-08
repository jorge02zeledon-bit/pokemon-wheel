"use client";

import { useEffect, useMemo, useState } from "react";
import type { RecentWin } from "@/server/wheels/recent-wins";
import { formatCents } from "@/lib/money";
import { TierBadge } from "./TierBadge";

/** Polls the public recent-wins feed. `pushed` lets the page prepend the user's own win instantly. */
export function RecentWins({ wheelSlug, initial, pushed }: { wheelSlug: string; initial: RecentWin[]; pushed?: RecentWin | null }) {
  const [fetched, setFetched] = useState(initial);
  // The viewer's own win is shown immediately, ahead of the next poll.
  const wins = useMemo(
    () => (pushed && !fetched.some((x) => x.id === pushed.id) ? [pushed, ...fetched].slice(0, 50) : fetched),
    [fetched, pushed],
  );

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/wheels/${wheelSlug}/recent-wins`, { cache: "no-store" });
        if (r.ok && alive) setFetched(await r.json());
      } catch {
        /* ignore transient errors */
      }
    };
    const id = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [wheelSlug]);

  if (wins.length === 0) return <p className="text-sm text-muted">No wins yet. Be the first.</p>;
  return (
    <ul className="divide-y divide-border text-sm" aria-live="polite">
      {wins.map((w) => (
        <li key={w.id} className="flex items-center gap-3 py-2">
          <TierBadge rarity={w.rarity} name={w.tierName} />
          <span className="min-w-0 flex-1 truncate">
            <span className="text-muted">{w.player}</span> won <span className="font-medium">{w.productName}</span>
          </span>
          <span className="font-mono text-muted">{formatCents(w.valueCents, { compact: true })}</span>
          <time dateTime={w.createdAt} className="hidden text-xs text-muted sm:block">
            {timeAgo(w.createdAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
