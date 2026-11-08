import { beforeAll, describe, expect, it } from "vitest";
import { resetDb, seedDb, testPrisma } from "./db";
import { oddsSumToOneHundred } from "@/server/engine/odds";

/**
 * Seed integrity: every wheel's odds total 100%, every tier has at least one
 * in-stock product, and the five launch wheels match the brief.
 */
describe("seed data", () => {
  beforeAll(async () => {
    await resetDb();
    seedDb();
  });

  it("creates the five launch wheels with correct spin prices", async () => {
    const wheels = await testPrisma.wheel.findMany({ orderBy: { sortOrder: "asc" } });
    expect(wheels.map((w) => [w.slug, w.spinPriceCents])).toEqual([
      ["pack-wheel", 1000],
      ["tin-collection-wheel", 2500],
      ["etb-wheel", 10000],
      ["japanese-box-wheel", 9500],
      ["premium-chase-wheel", 30000],
    ]);
  });

  it("gives every wheel odds that sum to exactly 100% and stocked products in every tier", async () => {
    const wheels = await testPrisma.wheel.findMany({
      include: { tiers: { include: { products: { include: { product: true } } } } },
    });
    for (const w of wheels) {
      expect(oddsSumToOneHundred(w.tiers), w.slug).toBe(true);
      for (const t of w.tiers) {
        expect(t.products.length, `${w.slug}/${t.name}`).toBeGreaterThan(0);
        for (const tp of t.products) expect(tp.product.stock, tp.product.slug).toBeGreaterThan(0);
      }
    }
  });

  it("seeds the default blocked states, settings and an admin", async () => {
    const codes = (await testPrisma.blockedState.findMany()).map((s) => s.code).sort();
    expect(codes).toEqual(["MT", "NV", "WA"]);
    const buyback = await testPrisma.setting.findUnique({ where: { key: "buybackPercent" } });
    expect(buyback?.value).toBe(80);
    const admin = await testPrisma.user.findUnique({ where: { email: "admin@test.local" } });
    expect(admin?.role).toBe("ADMIN");
    expect(admin?.nextServerSeedHash).toHaveLength(64);
  });

  it("is idempotent", async () => {
    seedDb();
    expect(await testPrisma.wheel.count()).toBe(5);
    expect(await testPrisma.tier.count()).toBe(20);
    expect(await testPrisma.product.count()).toBe(28);
  });
});
