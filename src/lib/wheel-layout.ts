import { BPS_SCALE } from "./money";

/**
 * Pure geometry for the on-screen wheel.
 *
 * Honesty rule: the total arc drawn for a tier is EXACTLY proportional to its
 * odds. Big tiers are split into several equal slices and interleaved with the
 * small ones so the wheel looks like a wheel, but the arcs still add up to the
 * configured odds. A 1% chase tier is a 3.6° sliver; we draw it with a glow
 * rather than inflating it.
 *
 * Angles: basis-point position 0 sits under the pointer (top of the wheel)
 * and positions increase clockwise. Rotating the wheel clockwise by θ moves
 * position p to angle(p) + θ, so position p is under the pointer when
 * θ ≡ -angle(p) (mod 2π).
 */

export interface LayoutTier {
  id: string;
  oddsBps: number;
}

export interface Slice {
  tierId: string;
  /** Inclusive start position in basis points. */
  startBps: number;
  /** Exclusive end position in basis points. */
  endBps: number;
  /** Index of this slice among its tier's slices. */
  indexInTier: number;
}

/** One slice per ~10% of odds, minimum one slice per tier. */
export function sliceCount(oddsBps: number): number {
  return Math.max(1, Math.round(oddsBps / 1000));
}

/**
 * Smooth weighted round-robin: returns an order of tier ids where each tier
 * appears `count` times, spread as evenly as possible around the wheel.
 */
export function interleave(counts: { id: string; count: number }[]): string[] {
  const total = counts.reduce((a, c) => a + c.count, 0);
  const current = new Map(counts.map((c) => [c.id, 0]));
  const out: string[] = [];
  for (let i = 0; i < total; i++) {
    let best: { id: string; count: number } | null = null;
    for (const c of counts) {
      current.set(c.id, (current.get(c.id) ?? 0) + c.count);
      if (!best || (current.get(c.id) ?? 0) > (current.get(best.id) ?? 0)) best = c;
    }
    if (!best) break;
    current.set(best.id, (current.get(best.id) ?? 0) - total);
    out.push(best.id);
  }
  return out;
}

/** Build the slice list. Slice arcs within a tier sum exactly to its odds. */
export function buildSlices(tiers: readonly LayoutTier[]): Slice[] {
  const active = tiers.filter((t) => t.oddsBps > 0);
  const counts = active.map((t) => ({ id: t.id, count: sliceCount(t.oddsBps) }));
  const order = interleave(counts);
  // Distribute each tier's bps across its slices in whole bps so sums are exact.
  const perTier = new Map<string, number[]>();
  for (const t of active) {
    const n = sliceCount(t.oddsBps);
    const base = Math.floor(t.oddsBps / n);
    const extra = t.oddsBps - base * n; // first `extra` slices get +1 bps
    perTier.set(t.id, Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0)));
  }
  const seen = new Map<string, number>();
  const slices: Slice[] = [];
  let cursor = 0;
  for (const id of order) {
    const idx = seen.get(id) ?? 0;
    seen.set(id, idx + 1);
    const width = perTier.get(id)![idx];
    slices.push({ tierId: id, startBps: cursor, endBps: cursor + width, indexInTier: idx });
    cursor += width;
  }
  return slices;
}

/** Convert a basis-point position to radians clockwise from the pointer. */
export function bpsToRadians(bps: number): number {
  return (bps / BPS_SCALE) * Math.PI * 2;
}

/**
 * Choose where inside the winning tier the pointer should land. Purely
 * cosmetic: the tier is already decided by the server. `rand` is only used to
 * vary the picture; it never affects the outcome.
 */
export function pickLandingBps(slices: readonly Slice[], tierId: string, rand: () => number = Math.random): number {
  const candidates = slices.filter((s) => s.tierId === tierId);
  if (candidates.length === 0) throw new Error(`No slices for tier ${tierId}`);
  const slice = candidates[Math.floor(rand() * candidates.length) % candidates.length];
  // Stay 15% away from the slice edges so the pointer is not ambiguous.
  const width = slice.endBps - slice.startBps;
  const margin = width * 0.15;
  return slice.startBps + margin + rand() * (width - 2 * margin);
}

/**
 * Final wheel rotation that puts `landingBps` under the pointer, at least
 * `minTurns` full turns beyond `currentRotation` (radians).
 */
export function targetRotation(currentRotation: number, landingBps: number, minTurns = 4): number {
  const twoPi = Math.PI * 2;
  const wanted = (-bpsToRadians(landingBps)) % twoPi; // rotation (mod 2π) that aligns the point
  const base = currentRotation + minTurns * twoPi;
  let delta = (wanted - base) % twoPi;
  if (delta < 0) delta += twoPi;
  return base + delta;
}

/** Which position (bps) is currently under the pointer for a given rotation. */
export function positionUnderPointer(rotation: number): number {
  const twoPi = Math.PI * 2;
  let r = (-rotation) % twoPi;
  if (r < 0) r += twoPi;
  return (r / twoPi) * BPS_SCALE;
}

/** Ease-out used for the settle phase. */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}
