import { describe, expect, it } from "vitest";
import { computeWheelEv, tierExpectedValue } from "@/server/engine/ev";
import { wheels, products } from "../../prisma/seed-data";

const opts = { rtpWarnMinPercent: 80, rtpWarnMaxPercent: 95 };
const byslug = new Map(products.map((p) => [p.slug, p]));
const seeded = (slug: string) => {
  const w = wheels.find((x) => x.slug === slug)!;
  return {
    spinPriceCents: w.spinPriceCents,
    tiers: w.tiers.map((t) => ({ name: t.name, oddsBps: t.oddsBps, products: t.products.map((s) => ({ ...byslug.get(s)! })) })),
  };
};

describe("EV / RTP calculator", () => {
  it("tier EV is the mean of its product values", () => {
    expect(tierExpectedValue({ oddsBps: 1, products: [{ valueCents: 14000 }, { valueCents: 15000 }] })).toBe(14500);
    expect(tierExpectedValue({ oddsBps: 1, products: [] })).toBe(0);
  });

  it("computes the pack wheel by hand: EV $7.28, RTP 72.8%", () => {
    const r = computeWheelEv(seeded("pack-wheel"), opts);
    // 0.8*500 + 0.1*1100 + 0.08*1600 + 0.02*4500 = 400 + 110 + 128 + 90 = 728
    expect(r.evCents).toBe(728);
    expect(r.rtpPercent).toBeCloseTo(72.8, 5);
    expect(r.minPrizeCents).toBe(500);
    expect(r.maxPrizeCents).toBe(4500);
    expect(r.topMultiplier).toBeCloseTo(4.5);
    expect(r.marginCents).toBe(272);
    expect(r.valid).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(["RTP_LOW"]);
  });

  it("computes the premium wheel: EV $257, RTP 85.67%, no warnings", () => {
    const r = computeWheelEv(seeded("premium-chase-wheel"), opts);
    // 0.6*17000 + 0.28*20000 + 0.1*55000 + 0.02*220000 = 10200 + 5600 + 5500 + 4400 = 25700
    expect(r.evCents).toBe(25700);
    expect(r.rtpPercent).toBeCloseTo(85.6667, 3);
    expect(r.warnings).toEqual([]);
  });

  it("flags odds that do not total 100% as an error and keeps computing", () => {
    const w = seeded("etb-wheel");
    w.tiers[3].oddsBps = 50;
    const r = computeWheelEv(w, opts);
    expect(r.valid).toBe(false);
    expect(r.warnings.find((x) => x.code === "ODDS_SUM")?.severity).toBe("error");
    expect(r.oddsSumBps).toBe(9950);
  });

  it("flags empty tiers, zero price, RTP too high, floor violations, stock and inactive products", () => {
    const r = computeWheelEv(
      {
        spinPriceCents: 1000,
        guaranteedFloor: true,
        tiers: [
          { name: "A", oddsBps: 9000, products: [{ name: "Cheap", valueCents: 900, stock: 0 }] },
          { name: "B", oddsBps: 1000, products: [{ name: "Big", valueCents: 10000, stock: 5, isActive: false }] },
          { name: "Empty", oddsBps: 0, products: [] }, // 0-odds tier is ignored
        ],
      },
      opts,
    );
    // EV = 0.9*900 + 0.1*10000 = 810 + 1000 = 1810 -> 181%
    expect(r.evCents).toBe(1810);
    expect(r.rtpPercent).toBeCloseTo(181);
    const codes = r.warnings.map((w) => w.code).sort();
    expect(codes).toEqual(["FLOOR_VIOLATION", "INACTIVE_PRODUCT", "OUT_OF_STOCK", "RTP_HIGH"]);
    expect(r.valid).toBe(true); // all advisory

    const bad = computeWheelEv({ spinPriceCents: 0, tiers: [{ name: "X", oddsBps: 10000, products: [] }] }, opts);
    expect(bad.valid).toBe(false);
    expect(bad.warnings.map((w) => w.code).sort()).toEqual(["EMPTY_TIER", "PRICE_ZERO"]);
    expect(computeWheelEv({ spinPriceCents: 100, tiers: [] }, opts).warnings.map((w) => w.code).sort()).toEqual(["NO_TIERS", "ODDS_SUM"]);
  });

  it("reports every seeded wheel's RTP so the admin sees it on day one", () => {
    const table = wheels.map((w) => {
      const r = computeWheelEv(seeded(w.slug), opts);
      return [w.slug, (r.evCents / 100).toFixed(2), r.rtpPercent.toFixed(1), r.warnings.map((x) => x.code).join(",")];
    });
    console.table(table);
    for (const w of wheels) expect(computeWheelEv(seeded(w.slug), opts).valid).toBe(true);
  });
});
