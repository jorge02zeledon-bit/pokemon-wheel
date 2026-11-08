"use client";

import { useEffect, useState } from "react";

/** Live "time left" label. Turns amber under 24h and red under 1h. */
export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return <span className="text-danger">Window closed</span>;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const label = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  const tone = ms < 3_600_000 ? "text-danger" : ms < 86_400_000 ? "text-warning" : "text-text";
  return (
    <time dateTime={until} className={`font-mono ${tone}`} title={new Date(until).toLocaleString("en-US")}>
      {label} left
    </time>
  );
}
