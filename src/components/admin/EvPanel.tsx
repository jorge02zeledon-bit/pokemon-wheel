import type { EvResult } from "@/server/engine/ev";
import { formatCents } from "@/lib/money";

/** Live EV / RTP read-out with warnings. Used in the wheel editor and the wheel list. */
export function EvPanel({ ev, rtpRange, compact = false }: { ev: EvResult; rtpRange: { min: number; max: number }; compact?: boolean }) {
  const rtpTone = ev.rtpPercent < rtpRange.min || ev.rtpPercent > rtpRange.max ? "text-warning" : "text-success";
  return (
    <div className={compact ? "space-y-1 text-xs" : "card space-y-4 p-5"}>
      {!compact && <h3 className="text-lg font-bold">Expected value</h3>}
      <dl className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
        <div><dt className="text-xs uppercase tracking-wide text-muted">EV / spin</dt><dd className="font-mono font-semibold">{formatCents(ev.evCents)}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-muted">RTP</dt><dd className={`font-mono font-semibold ${rtpTone}`}>{ev.rtpPercent.toFixed(1)}%</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-muted">Margin / spin</dt><dd className="font-mono">{formatCents(ev.marginCents)}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-muted">Odds total</dt><dd className={`font-mono ${ev.oddsSumBps === 10_000 ? "" : "text-danger"}`}>{(ev.oddsSumBps / 100).toFixed(2)}%</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-muted">Prize range</dt><dd className="font-mono">{formatCents(ev.minPrizeCents, { compact: true })} – {formatCents(ev.maxPrizeCents, { compact: true })}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-muted">Top prize</dt><dd className="font-mono">{ev.topMultiplier.toFixed(1)}× spin</dd></div>
      </dl>
      {!compact && <p className="text-xs text-muted">Target RTP range: {rtpRange.min}% – {rtpRange.max}% (change in Settings).</p>}
      {ev.warnings.length > 0 && (
        <ul className="space-y-1">
          {ev.warnings.map((w) => (
            <li key={w.code + w.message} className={`rounded-lg px-3 py-1.5 text-xs ${w.severity === "error" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning"}`}>
              {w.severity === "error" ? "Error: " : "Warning: "}{w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
