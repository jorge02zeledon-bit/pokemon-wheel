import { formatBps, formatCents } from "@/lib/money";
import type { WheelWithTiers } from "@/server/wheels/queries";
import { TierBadge } from "./TierBadge";

/**
 * Public disclosure of a wheel's tiers, odds and every product that can be won.
 * Shown on the wheel page before the user spins and on the Odds & Rules page.
 */
export function OddsTable({ wheel }: { wheel: WheelWithTiers }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="py-2 pr-4">Tier</th>
            <th className="py-2 pr-4">Odds</th>
            <th className="py-2 pr-4">Products (one is awarded at random)</th>
            <th className="py-2 text-right">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {wheel.tiers.map((t) => (
            <tr key={t.id} className="align-top">
              <td className="py-3 pr-4"><TierBadge rarity={t.rarity} name={t.name} /></td>
              <td className="py-3 pr-4 font-mono">{formatBps(t.oddsBps)}</td>
              <td className="py-3 pr-4">
                <ul className="space-y-1">
                  {t.products.map((tp) => (
                    <li key={tp.productId} className="flex items-center gap-2">
                      <span>{tp.product.name}</span>
                      {tp.product.stock === 0 && <span className="badge bg-danger/20 text-danger">Out of stock</span>}
                    </li>
                  ))}
                </ul>
              </td>
              <td className="py-3 text-right font-mono">
                <ul className="space-y-1">
                  {t.products.map((tp) => (
                    <li key={tp.productId}>{formatCents(tp.product.valueCents, { compact: true })}</li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
