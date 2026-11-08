"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCents } from "@/lib/money";

interface Activity { spentLast24hCents: number; spentSessionCents: number; spinsLast24h: number; dailySpendLimitCents: number | null }

/**
 * Session spend tracker shown on wheel pages. "Session" starts when the tab
 * first loads the site (kept in sessionStorage); "today" is a rolling 24h.
 */
export function SessionSpend({ refreshKey }: { refreshKey: number }) {
  const [a, setA] = useState<Activity | null>(null);
  useEffect(() => {
    let since: string;
    try {
      since = sessionStorage.getItem("hw.sessionStart") ?? new Date().toISOString();
      sessionStorage.setItem("hw.sessionStart", since);
    } catch { since = new Date().toISOString(); }
    fetch(`/api/me/activity?since=${encodeURIComponent(since)}`, { cache: "no-store" }).then(async (r) => r.ok && setA(await r.json())).catch(() => {});
  }, [refreshKey]);
  if (!a) return null;
  const nearLimit = a.dailySpendLimitCents !== null && a.spentLast24hCents >= a.dailySpendLimitCents * 0.8;
  return (
    <p className="text-xs text-muted" aria-live="polite">
      This session: <span className="font-mono text-text">{formatCents(a.spentSessionCents)}</span> · Last 24h:{" "}
      <span className={`font-mono ${nearLimit ? "text-warning" : "text-text"}`}>{formatCents(a.spentLast24hCents)}</span>
      {a.dailySpendLimitCents !== null ? <> of your {formatCents(a.dailySpendLimitCents)} limit</> : <> · <Link href="/account#responsible-play" className="underline">set a limit</Link></>}
    </p>
  );
}
