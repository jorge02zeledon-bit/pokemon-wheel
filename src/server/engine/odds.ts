import { BPS_SCALE } from "@/lib/money";

/**
 * Pure odds helpers shared by the spin engine, admin validation and tests.
 */

export interface TierOdds {
  id: string;
  oddsBps: number;
}

/** Sum of odds across tiers in basis points. */
export function sumOddsBps(tiers: readonly TierOdds[]): number {
  return tiers.reduce((acc, t) => acc + t.oddsBps, 0);
}

/** True when the tiers' odds total exactly 100%. */
export function oddsSumToOneHundred(tiers: readonly TierOdds[]): boolean {
  return sumOddsBps(tiers) === BPS_SCALE;
}

/**
 * Select the tier a roll in [0, 10000) falls into, walking cumulative odds in
 * the given order. The order must be stable (sorted by sortOrder then id) so
 * verification reproduces the same answer.
 *
 * Throws if the odds don't sum to 100% or the roll is out of range.
 */
export function selectTier<T extends TierOdds>(tiers: readonly T[], tierRoll: number): T {
  if (!Number.isInteger(tierRoll) || tierRoll < 0 || tierRoll >= BPS_SCALE) {
    throw new RangeError(`tierRoll must be an integer in [0, ${BPS_SCALE}), got ${tierRoll}`);
  }
  if (!oddsSumToOneHundred(tiers)) {
    throw new Error(`Tier odds must sum to ${BPS_SCALE} bps, got ${sumOddsBps(tiers)}`);
  }
  let cumulative = 0;
  for (const tier of tiers) {
    cumulative += tier.oddsBps;
    if (tierRoll < cumulative) return tier;
  }
  // Unreachable when odds sum to 10,000 and roll < 10,000.
  throw new Error("selectTier: roll exceeded cumulative odds");
}

/** Pick an index in [0, count) from a 32-bit roll. Uniform for our small counts. */
export function selectIndex(productRoll: number, count: number): number {
  if (count <= 0) throw new RangeError("count must be positive");
  return productRoll % count;
}
