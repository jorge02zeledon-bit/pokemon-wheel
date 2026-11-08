import { describe, expect, it } from "vitest";
import { oddsSumToOneHundred, selectIndex, selectTier, sumOddsBps } from "@/server/engine/odds";

const tiers = [
  { id: "common", oddsBps: 8000 },
  { id: "uncommon", oddsBps: 1000 },
  { id: "rare", oddsBps: 800 },
  { id: "chase", oddsBps: 200 },
];

describe("odds helpers", () => {
  it("validates that odds sum to 100%", () => {
    expect(sumOddsBps(tiers)).toBe(10_000);
    expect(oddsSumToOneHundred(tiers)).toBe(true);
    expect(oddsSumToOneHundred(tiers.slice(1))).toBe(false);
  });

  it("selects tiers by cumulative odds at exact boundaries", () => {
    expect(selectTier(tiers, 0).id).toBe("common");
    expect(selectTier(tiers, 7999).id).toBe("common");
    expect(selectTier(tiers, 8000).id).toBe("uncommon");
    expect(selectTier(tiers, 8999).id).toBe("uncommon");
    expect(selectTier(tiers, 9000).id).toBe("rare");
    expect(selectTier(tiers, 9799).id).toBe("rare");
    expect(selectTier(tiers, 9800).id).toBe("chase");
    expect(selectTier(tiers, 9999).id).toBe("chase");
  });

  it("rejects invalid rolls and invalid odds", () => {
    expect(() => selectTier(tiers, -1)).toThrow(RangeError);
    expect(() => selectTier(tiers, 10_000)).toThrow(RangeError);
    expect(() => selectTier(tiers, 1.5)).toThrow(RangeError);
    expect(() => selectTier([{ id: "a", oddsBps: 5000 }], 0)).toThrow(/sum/);
  });

  it("picks product indexes within range", () => {
    expect(selectIndex(0, 3)).toBe(0);
    expect(selectIndex(7, 3)).toBe(1);
    expect(selectIndex(0xffffffff, 2)).toBe(1);
    expect(() => selectIndex(1, 0)).toThrow(RangeError);
  });
});
