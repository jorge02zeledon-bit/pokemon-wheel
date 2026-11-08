import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, seedDb, testPrisma } from "./db";
import { saveWheel } from "@/server/admin/wheels";
import { adjustStock } from "@/server/admin/products";
import { adjustBalance, setUserRole } from "@/server/admin/users";
import { addBlockedState, removeBlockedState, updateSettings } from "@/server/admin/settings";
import { updateOrder } from "@/server/admin/orders";
import { executeSpin } from "@/server/engine/spin";
import { applyLedgerEntry } from "@/server/wallet/ledger";
import { clearSettingsCache, getSettings } from "@/server/settings";
import { hashServerSeed } from "@/server/engine/fair";

/** Admin mutations: validation rules and audit logging, against the real database. */
describe("admin", () => {
  let adminId: string;
  beforeAll(async () => {
    await resetDb();
    seedDb();
    adminId = (await testPrisma.user.findUniqueOrThrow({ where: { email: "admin@test.local" } })).id;
  });
  beforeEach(async () => {
    clearSettingsCache();
    await testPrisma.product.updateMany({ data: { stock: 1000 } });
  });

  async function draftFor(slug: string) {
    const w = await testPrisma.wheel.findUniqueOrThrow({ where: { slug }, include: { tiers: { orderBy: { sortOrder: "asc" }, include: { products: true } } } });
    return {
      id: w.id, slug: w.slug, name: w.name, tagline: w.tagline ?? "", description: w.description ?? "", spinPriceCents: w.spinPriceCents,
      sortOrder: w.sortOrder, isActive: w.isActive, guaranteedFloor: w.guaranteedFloor, accentColor: w.accentColor,
      tiers: w.tiers.map((t) => ({ id: t.id, name: t.name, rarity: t.rarity, oddsBps: t.oddsBps, color: t.color, productIds: t.products.map((p) => p.productId) })),
    };
  }

  it("rejects a wheel whose odds do not total exactly 100%", async () => {
    const d = await draftFor("pack-wheel");
    d.tiers[3].oddsBps = 250;
    await expect(saveWheel(adminId, d)).rejects.toThrow(/exactly 100%/);
    d.tiers[3].oddsBps = 200;
    d.tiers[0].productIds = [];
    await expect(saveWheel(adminId, d)).rejects.toThrow(/needs at least one product/);
    expect(await testPrisma.adminAuditLog.count({ where: { action: "wheel.update" } })).toBe(0);
  });

  it("saves valid edits, re-links products and writes an audit entry", async () => {
    const d = await draftFor("pack-wheel");
    d.spinPriceCents = 1200;
    d.tiers[0].oddsBps = 7900;
    d.tiers[3].oddsBps = 300;
    const extra = await testPrisma.product.findUniqueOrThrow({ where: { slug: "brilliant-stars-booster-pack" } });
    d.tiers[0].productIds.push(extra.id);
    await saveWheel(adminId, d);
    const w = await testPrisma.wheel.findUniqueOrThrow({ where: { slug: "pack-wheel" }, include: { tiers: { orderBy: { sortOrder: "asc" }, include: { products: true } } } });
    expect(w.spinPriceCents).toBe(1200);
    expect(w.tiers.map((t) => t.oddsBps)).toEqual([7900, 1000, 800, 300]);
    expect(w.tiers[0].products).toHaveLength(2);
    const log = await testPrisma.adminAuditLog.findFirst({ where: { action: "wheel.update", entityId: w.id } });
    expect(log?.adminId).toBe(adminId);
    expect((log?.before as { spinPriceCents: number }).spinPriceCents).toBe(1000);
  });

  it("refuses to delete a tier that has been awarded, but allows retiring it at 0%", async () => {
    const user = await testPrisma.user.create({ data: { email: "t@t.local", passwordHash: "x", stateCode: "CA", ageConfirmedAt: new Date(), clientSeed: "c", nextServerSeed: "s".repeat(64), nextServerSeedHash: hashServerSeed("s".repeat(64)) } });
    await testPrisma.$transaction((tx) => applyLedgerEntry(tx, { userId: user.id, type: "DEMO_GRANT", amountCents: 1_000_000, isDemo: true }));
    const res = await executeSpin({ userId: user.id, wheelSlug: "etb-wheel" });
    const d = await draftFor("etb-wheel");
    const idx = d.tiers.findIndex((t) => t.id === res.tier.id);
    const removed = d.tiers.splice(idx, 1)[0];
    d.tiers[0].oddsBps += removed.oddsBps;
    await expect(saveWheel(adminId, d)).rejects.toThrow(/cannot be deleted/);

    // Retire instead: 0% odds, move its share elsewhere.
    const d2 = await draftFor("etb-wheel");
    const t = d2.tiers.find((x) => x.id === res.tier.id)!;
    const sink = d2.tiers.find((x) => x.id !== res.tier.id)!;
    sink.oddsBps += t.oddsBps;
    t.oddsBps = 0;
    await saveWheel(adminId, d2);
    // Retired tier is hidden from the public read model and never selected.
    const pub = await testPrisma.tier.findMany({ where: { wheelId: d2.id, oddsBps: { gt: 0 } } });
    expect(pub.map((x) => x.id)).not.toContain(res.tier.id);
    for (let i = 0; i < 30; i++) {
      const r = await executeSpin({ userId: user.id, wheelSlug: "etb-wheel" });
      expect(r.tier.id).not.toBe(res.tier.id);
    }
  });

  it("new tiers can be added and unreferenced tiers removed", async () => {
    const d = await draftFor("japanese-box-wheel");
    const chase = d.tiers.pop()!; // never awarded in this test db
    d.tiers.push({ name: "Mega Chase", rarity: "CHASE", oddsBps: chase.oddsBps, color: "#fbbf24", productIds: chase.productIds } as typeof chase);
    await saveWheel(adminId, d);
    const w = await testPrisma.wheel.findUniqueOrThrow({ where: { slug: "japanese-box-wheel" }, include: { tiers: true } });
    expect(w.tiers.map((t) => t.name)).toContain("Mega Chase");
    expect(w.tiers.find((t) => t.id === chase.id)).toBeUndefined();
    expect(w.tiers.reduce((a, t) => a + t.oddsBps, 0)).toBe(10_000);
  });

  it("stock adjustments need a reason, never go negative, and are audited", async () => {
    const p = await testPrisma.product.findUniqueOrThrow({ where: { slug: "jp-vmax-climax-box" } });
    await expect(adjustStock(adminId, p.id, 0, "x")).rejects.toThrow(/non-zero/);
    await expect(adjustStock(adminId, p.id, 5, " ")).rejects.toThrow(/reason/);
    await expect(adjustStock(adminId, p.id, -(p.stock + 1), "too many")).rejects.toThrow(/below zero/);
    const after = await adjustStock(adminId, p.id, 4, "Received shipment");
    expect(after.stock).toBe(p.stock + 4);
    const log = await testPrisma.adminAuditLog.findFirst({ where: { action: "product.stock", entityId: p.id } });
    expect(log?.after).toMatchObject({ delta: 4, reason: "Received shipment", stock: p.stock + 4 });
  });

  it("balance adjustments post a ledger entry with the reason and cannot overdraw", async () => {
    const u = await testPrisma.user.create({ data: { email: "b@t.local", passwordHash: "x", clientSeed: "c", nextServerSeed: "s", nextServerSeedHash: "h" } });
    await expect(adjustBalance(adminId, u.id, -100, true, "oops")).rejects.toThrow(/Insufficient/);
    await adjustBalance(adminId, u.id, 2500, false, "Goodwill credit");
    const row = await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.realBalanceCents).toBe(2500);
    expect(row.demoBalanceCents).toBe(0);
    const entry = await testPrisma.ledgerEntry.findFirst({ where: { userId: u.id, type: "ADJUSTMENT" } });
    expect(entry?.description).toContain("Goodwill credit");
    expect(entry?.referenceId).toBe(adminId);
  });

  it("an admin cannot demote themselves", async () => {
    await expect(setUserRole(adminId, adminId, "USER")).rejects.toThrow(/own admin role/);
  });

  it("settings: validates, applies only changes, keeps RTP min <= max, and audits", async () => {
    const changed = await updateSettings(adminId, { buybackPercent: 75, vaultWindowDays: 7, unknownKey: 1 });
    expect(changed).toEqual(["buybackPercent"]);
    expect((await getSettings()).buybackPercent).toBe(75);
    await expect(updateSettings(adminId, { rtpWarnMinPercent: 99 })).rejects.toThrow(/must not exceed/);
    await expect(updateSettings(adminId, { buybackPercent: 150 })).rejects.toThrow(/buybackPercent/);
    await updateSettings(adminId, { buybackPercent: 80 });
    expect(await testPrisma.adminAuditLog.count({ where: { action: "settings.update" } })).toBe(2);
  });

  it("blocked states can be added and removed and take effect in the engine", async () => {
    await addBlockedState(adminId, "id", "test");
    expect((await testPrisma.blockedState.findUnique({ where: { code: "ID" } }))?.name).toBe("Idaho");
    await expect(addBlockedState(adminId, "ZZ")).rejects.toThrow(/Unknown/);
    const user = await testPrisma.user.create({ data: { email: "idaho@t.local", passwordHash: "x", stateCode: "ID", ageConfirmedAt: new Date(), clientSeed: "c", nextServerSeed: "s".repeat(64), nextServerSeedHash: hashServerSeed("s".repeat(64)) } });
    await testPrisma.$transaction((tx) => applyLedgerEntry(tx, { userId: user.id, type: "DEMO_GRANT", amountCents: 10_000, isDemo: true }));
    await expect(executeSpin({ userId: user.id, wheelSlug: "pack-wheel" })).rejects.toMatchObject({ reason: "BLOCKED_STATE" });
    await removeBlockedState(adminId, "ID");
    await executeSpin({ userId: user.id, wheelSlug: "pack-wheel" });
  });

  it("orders: shipping requires a tracking number and syncs the vault item", async () => {
    const u = await testPrisma.user.create({ data: { email: "o@t.local", passwordHash: "x", clientSeed: "c", nextServerSeed: "s", nextServerSeedHash: "h" } });
    const product = await testPrisma.product.findFirstOrThrow();
    const wheel = await testPrisma.wheel.findFirstOrThrow({ include: { tiers: true } });
    const spin = await testPrisma.spin.create({ data: { userId: u.id, wheelId: wheel.id, tierId: wheel.tiers[0].id, productId: product.id, spinPriceCents: 1, productValueCents: 1, isDemo: false, serverSeed: "s", serverSeedHash: "h", clientSeed: "c", nonce: 1, resultHash: "r", tierRoll: 0, productRoll: 0, oddsSnapshot: {} } });
    const order = await testPrisma.order.create({ data: { userId: u.id, shippingFeeCents: 995, recipientName: "A", line1: "1", city: "C", state: "TX", postalCode: "78701" } });
    const item = await testPrisma.vaultItem.create({ data: { userId: u.id, spinId: spin.id, productId: product.id, valueCents: 1, isDemo: false, status: "SHIP_REQUESTED", orderId: order.id } });
    await expect(updateOrder(adminId, order.id, { status: "SHIPPED", trackingNumber: "" })).rejects.toThrow(/tracking number/);
    await updateOrder(adminId, order.id, { status: "SHIPPED", carrier: "USPS", trackingNumber: "9400 1111", adminNotes: "" });
    expect((await testPrisma.vaultItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("SHIPPED");
    expect((await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })).trackingNumber).toBe("9400 1111");
  });
});
