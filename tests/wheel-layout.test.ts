import { describe, expect, it } from "vitest";
import { buildSlices, interleave, pickLandingBps, positionUnderPointer, sliceCount, targetRotation } from "@/lib/wheel-layout";
import { wheels } from "../prisma/seed-data";
import { selectTier } from "@/server/engine/odds";

describe("wheel layout", () => {
  it("slice arcs per tier sum exactly to the tier's odds, and the whole wheel to 10,000", () => {
    for (const w of wheels) {
      const tiers = w.tiers.map((t) => ({ id: t.name, oddsBps: t.oddsBps }));
      const slices = buildSlices(tiers);
      expect(slices[0].startBps).toBe(0);
      expect(slices.at(-1)!.endBps).toBe(10_000);
      for (let i = 1; i < slices.length; i++) expect(slices[i].startBps).toBe(slices[i - 1].endBps);
      for (const t of tiers) {
        const total = slices.filter((s) => s.tierId === t.id).reduce((a, s) => a + (s.endBps - s.startBps), 0);
        expect(total, `${w.slug}/${t.id}`).toBe(t.oddsBps);
      }
    }
  });

  it("splits big tiers and keeps tiny ones as a single slice", () => {
    expect(sliceCount(8000)).toBe(8);
    expect(sliceCount(2800)).toBe(3);
    expect(sliceCount(200)).toBe(1);
    expect(sliceCount(100)).toBe(1);
  });

  it("interleaves slices so small tiers are spread among the big one", () => {
    const order = interleave([{ id: "c", count: 8 }, { id: "u", count: 1 }, { id: "r", count: 1 }, { id: "x", count: 1 }]);
    expect(order).toHaveLength(11);
    expect(order.filter((o) => o === "c")).toHaveLength(8);
    // No two non-common slices adjacent.
    for (let i = 1; i < order.length; i++) expect(order[i] === "c" || order[i - 1] === "c").toBe(true);
  });

  it("landing position always falls inside a slice of the winning tier", () => {
    const tiers = wheels[0].tiers.map((t) => ({ id: t.name, oddsBps: t.oddsBps }));
    const slices = buildSlices(tiers);
    for (const t of tiers) {
      for (let i = 0; i < 200; i++) {
        const bps = pickLandingBps(slices, t.id);
        const slice = slices.find((s) => bps >= s.startBps && bps < s.endBps);
        expect(slice?.tierId).toBe(t.id);
      }
    }
  });

  it("target rotation lands the chosen position under the pointer after at least the minimum turns", () => {
    for (let i = 0; i < 500; i++) {
      const current = Math.random() * 100;
      const landing = Math.random() * 10_000;
      const target = targetRotation(current, landing, 4);
      expect(target - current).toBeGreaterThanOrEqual(4 * Math.PI * 2 - 1e-9);
      expect(target - current).toBeLessThan(5 * Math.PI * 2 + 1e-9);
      expect(Math.abs(positionUnderPointer(target) - landing) % 10_000).toBeLessThan(1e-6);
    }
  });

  it("the drawn wheel agrees with the engine: the position under the pointer maps to the server's tier", () => {
    // If the animation lands on `landing` for server tier T, the slice at that
    // position must be T's, and the engine's cumulative selection for the
    // canonical order must also be consistent with the tier arcs.
    const wheel = wheels[2];
    const tiers = wheel.tiers.map((t) => ({ id: t.name, oddsBps: t.oddsBps }));
    const slices = buildSlices(tiers);
    for (const t of tiers) {
      const landing = pickLandingBps(slices, t.id);
      const target = targetRotation(0, landing);
      const under = positionUnderPointer(target);
      const slice = slices.find((s) => under >= s.startBps && under < s.endBps)!;
      expect(slice.tierId).toBe(t.id);
    }
    // Engine sanity: rolls at a tier's cumulative range select that tier.
    expect(selectTier(tiers, 0).id).toBe("Common");
    expect(selectTier(tiers, 9999).id).toBe("Chase");
  });
});
