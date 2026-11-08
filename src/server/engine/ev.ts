import { BPS_SCALE } from "@/lib/money";

/**
 * Expected value, return-to-player and configuration warnings for a wheel.
 * Pure and shared by the admin editor (live, client-side) and the server
 * (validation on save, public odds page). Money in cents, odds in bps.
 *
 * Within a tier the product is chosen uniformly, so a tier's expected value is
 * the mean of its product values.
 */

export interface EvProduct {
  valueCents: number;
  stock?: number;
  isActive?: boolean;
  name?: string;
}
export interface EvTier {
  name?: string;
  oddsBps: number;
  products: EvProduct[];
}
export interface EvWheel {
  spinPriceCents: number;
  guaranteedFloor?: boolean;
  tiers: EvTier[];
}
export interface EvOptions {
  rtpWarnMinPercent: number;
  rtpWarnMaxPercent: number;
}

export type WarningCode =
  | "NO_TIERS"
  | "ODDS_SUM"
  | "EMPTY_TIER"
  | "PRICE_ZERO"
  | "RTP_LOW"
  | "RTP_HIGH"
  | "FLOOR_VIOLATION"
  | "OUT_OF_STOCK"
  | "INACTIVE_PRODUCT";

export interface EvWarning {
  code: WarningCode;
  /** "error" blocks saving / spinning; "warning" is advisory. */
  severity: "error" | "warning";
  message: string;
}

export interface EvResult {
  oddsSumBps: number;
  /** Expected prize value per spin, in cents (rounded to the nearest cent). */
  evCents: number;
  /** Unrounded EV for display precision. */
  evExact: number;
  /** EV / spin price * 100. 0 when the price is 0. */
  rtpPercent: number;
  minPrizeCents: number;
  maxPrizeCents: number;
  /** Top prize value / spin price. */
  topMultiplier: number;
  /** Operator margin per spin in cents (price - EV). */
  marginCents: number;
  warnings: EvWarning[];
  /** True when nothing with severity "error" is present. */
  valid: boolean;
}

export function tierExpectedValue(tier: EvTier): number {
  if (tier.products.length === 0) return 0;
  const sum = tier.products.reduce((a, p) => a + p.valueCents, 0);
  return sum / tier.products.length;
}

export function computeWheelEv(wheel: EvWheel, opts: EvOptions): EvResult {
  const warnings: EvWarning[] = [];
  const live = wheel.tiers.filter((t) => t.oddsBps > 0);
  const oddsSumBps = wheel.tiers.reduce((a, t) => a + t.oddsBps, 0);

  if (wheel.tiers.length === 0) warnings.push({ code: "NO_TIERS", severity: "error", message: "Add at least one tier." });
  if (oddsSumBps !== BPS_SCALE) {
    warnings.push({ code: "ODDS_SUM", severity: "error", message: `Odds total ${(oddsSumBps / 100).toFixed(2)}%; they must total exactly 100%.` });
  }
  for (const t of live) {
    if (t.products.length === 0) {
      warnings.push({ code: "EMPTY_TIER", severity: "error", message: `Tier "${t.name ?? "?"}" has no products.` });
    }
  }
  if (wheel.spinPriceCents <= 0) warnings.push({ code: "PRICE_ZERO", severity: "error", message: "Spin price must be greater than $0." });

  const evExact = live.reduce((a, t) => a + (t.oddsBps / BPS_SCALE) * tierExpectedValue(t), 0);
  const evCents = Math.round(evExact);
  const rtpPercent = wheel.spinPriceCents > 0 ? (evExact / wheel.spinPriceCents) * 100 : 0;

  const products = live.flatMap((t) => t.products);
  const values = products.map((p) => p.valueCents);
  const minPrizeCents = values.length ? Math.min(...values) : 0;
  const maxPrizeCents = values.length ? Math.max(...values) : 0;
  const topMultiplier = wheel.spinPriceCents > 0 ? maxPrizeCents / wheel.spinPriceCents : 0;

  if (wheel.spinPriceCents > 0 && values.length > 0) {
    if (rtpPercent < opts.rtpWarnMinPercent) {
      warnings.push({ code: "RTP_LOW", severity: "warning", message: `RTP ${rtpPercent.toFixed(1)}% is below the configured minimum of ${opts.rtpWarnMinPercent}%.` });
    } else if (rtpPercent > opts.rtpWarnMaxPercent) {
      warnings.push({ code: "RTP_HIGH", severity: "warning", message: `RTP ${rtpPercent.toFixed(1)}% is above the configured maximum of ${opts.rtpWarnMaxPercent}%.` });
    }
    if (wheel.guaranteedFloor && minPrizeCents < wheel.spinPriceCents) {
      warnings.push({ code: "FLOOR_VIOLATION", severity: "warning", message: `Guaranteed floor is on but the lowest prize ($${(minPrizeCents / 100).toFixed(2)}) is worth less than the spin price.` });
    }
  }
  const outOfStock = products.filter((p) => p.stock !== undefined && p.stock < 1);
  if (outOfStock.length > 0) {
    warnings.push({ code: "OUT_OF_STOCK", severity: "warning", message: `Out of stock (wheel is paused): ${outOfStock.map((p) => p.name ?? "a product").join(", ")}.` });
  }
  const inactive = products.filter((p) => p.isActive === false);
  if (inactive.length > 0) {
    warnings.push({ code: "INACTIVE_PRODUCT", severity: "warning", message: `Inactive products (wheel is paused): ${inactive.map((p) => p.name ?? "a product").join(", ")}.` });
  }

  return {
    oddsSumBps,
    evCents,
    evExact,
    rtpPercent,
    minPrizeCents,
    maxPrizeCents,
    topMultiplier,
    marginCents: wheel.spinPriceCents - evCents,
    warnings,
    valid: warnings.every((w) => w.severity !== "error"),
  };
}
