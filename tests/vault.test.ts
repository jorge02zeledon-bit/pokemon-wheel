import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, seedDb, testPrisma } from "./db";
import { executeSpin } from "@/server/engine/spin";
import { applyLedgerEntry, InsufficientFundsError } from "@/server/wallet/ledger";
import { requestShipping, sellBack, VaultItemUnavailableError } from "@/server/vault/decisions";
import { processExpiredVaultItems } from "@/server/vault/expiry";
import { RealMoneyDisabledError, ForbiddenError } from "@/server/errors";
import { clearSettingsCache, setSetting } from "@/server/settings";
import { hashServerSeed } from "@/server/engine/fair";

const ADDRESS = { recipientName: "Pat Example", line1: "1 Main St", city: "Austin", state: "TX", postalCode: "78701" };

async function makeUser(demo = 100_000, real = 0) {
  const seed = "b".repeat(64);
  const u = await testPrisma.user.create({
    data: { email: `v${Math.random()}@t.local`, passwordHash: "x", stateCode: "TX", ageConfirmedAt: new Date(), clientSeed: "c", nextServerSeed: seed, nextServerSeedHash: hashServerSeed(seed) },
  });
  await testPrisma.$transaction(async (tx) => {
    if (demo) await applyLedgerEntry(tx, { userId: u.id, type: "DEMO_GRANT", amountCents: demo, isDemo: true });
    if (real) await applyLedgerEntry(tx, { userId: u.id, type: "DEPOSIT", amountCents: real, isDemo: false });
  });
  return u;
}

/** Win one item on the pack wheel and return its vault row. */
async function winItem(userId: string) {
  const res = await executeSpin({ userId, wheelSlug: "pack-wheel" });
  return testPrisma.vaultItem.findUniqueOrThrow({ where: { id: res.vault.id } });
}

function setRealMoney(on: boolean) {
  process.env.REAL_MONEY_ENABLED = on ? "true" : "false";
}

describe("vault", () => {
  beforeAll(async () => {
    await resetDb();
    seedDb();
  });
  beforeEach(async () => {
    clearSettingsCache();
    setRealMoney(false);
    await testPrisma.product.updateMany({ data: { stock: 1000 } });
  });
  afterEach(() => setRealMoney(false));

  it("sell-back credits exactly 80% of the win-time value to the balance the item was won with", async () => {
    const user = await makeUser();
    const item = await winItem(user.id);
    const before = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const r = await sellBack(user.id, item.id);
    expect(r.buybackCents).toBe(Math.round(item.valueCents * 0.8));
    expect(r.item.status).toBe("SOLD");
    expect(r.item.autoDecided).toBe(false);
    expect(r.item.expiresAt).toBeNull();
    const after = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.demoBalanceCents).toBe(before.demoBalanceCents + r.buybackCents);
    expect(after.realBalanceCents).toBe(0); // demo item -> demo credits, never real money
    const entry = await testPrisma.ledgerEntry.findFirst({ where: { userId: user.id, type: "BUYBACK" } });
    expect(entry?.amountCents).toBe(r.buybackCents);
    expect(entry?.isDemo).toBe(true);
    expect(entry?.referenceId).toBe(item.id);
  });

  it("uses the buyback percentage in force at decision time and rounds to the cent", async () => {
    await setSetting("buybackPercent", 75);
    const user = await makeUser();
    const item = await winItem(user.id);
    // Pack wheel values: 500, 1100, 1600, 4500 -> 75% = 375, 825, 1200, 3375
    const r = await sellBack(user.id, item.id);
    expect(r.buybackCents).toBe(Math.round(item.valueCents * 0.75));
    await setSetting("buybackPercent", 80);
  });

  it("cannot sell twice, cannot sell another user's item", async () => {
    const user = await makeUser();
    const other = await makeUser();
    const item = await winItem(user.id);
    await expect(sellBack(other.id, item.id)).rejects.toBeInstanceOf(ForbiddenError);
    await sellBack(user.id, item.id);
    await expect(sellBack(user.id, item.id)).rejects.toBeInstanceOf(VaultItemUnavailableError);
    const entries = await testPrisma.ledgerEntry.count({ where: { userId: user.id, type: "BUYBACK" } });
    expect(entries).toBe(1);
  });

  it("concurrent sell requests credit exactly once", async () => {
    const user = await makeUser();
    const item = await winItem(user.id);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => sellBack(user.id, item.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await testPrisma.ledgerEntry.count({ where: { userId: user.id, type: "BUYBACK" } })).toBe(1);
  });

  it("shipping is impossible in demo mode, enforced on the server", async () => {
    const user = await makeUser();
    const item = await winItem(user.id);
    await expect(requestShipping(user.id, item.id, ADDRESS)).rejects.toBeInstanceOf(RealMoneyDisabledError);
    expect(await testPrisma.order.count()).toBe(0);
    expect((await testPrisma.vaultItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("PENDING");
  });

  it("items won with demo credits can never be shipped, even once real money is on", async () => {
    const user = await makeUser();
    const item = await winItem(user.id); // isDemo = true
    setRealMoney(true);
    await expect(requestShipping(user.id, item.id, ADDRESS)).rejects.toThrow(/demo credits cannot be shipped/);
    expect(await testPrisma.order.count()).toBe(0);
  });

  it("in real-money mode, shipping charges the flat fee from the real balance and creates an order", async () => {
    setRealMoney(true);
    const user = await makeUser(0, 50_000);
    const res = await executeSpin({ userId: user.id, wheelSlug: "pack-wheel" }); // real spin: $10
    const item = await testPrisma.vaultItem.findUniqueOrThrow({ where: { id: res.vault.id } });
    expect(item.isDemo).toBe(false);

    const r = await requestShipping(user.id, item.id, { ...ADDRESS, line2: "Apt 4" });
    expect(r.feeCents).toBe(995);
    expect(r.balanceAfterCents).toBe(50_000 - 1000 - 995);
    expect(r.item.status).toBe("SHIP_REQUESTED");
    expect(r.item.orderId).toBe(r.order.id);
    expect(r.order).toMatchObject({ status: "REQUESTED", recipientName: "Pat Example", line2: "Apt 4", state: "TX", country: "US", shippingFeeCents: 995, trackingNumber: null });
    const fee = await testPrisma.ledgerEntry.findFirst({ where: { userId: user.id, type: "SHIPPING_FEE" } });
    expect(fee).toMatchObject({ amountCents: -995, isDemo: false });

    // Already decided: neither action is possible now.
    await expect(sellBack(user.id, item.id)).rejects.toBeInstanceOf(VaultItemUnavailableError);
    await expect(requestShipping(user.id, item.id, ADDRESS)).rejects.toBeInstanceOf(VaultItemUnavailableError);
  });

  it("refuses shipping when the real balance cannot cover the fee, leaving no order", async () => {
    setRealMoney(true);
    const user = await makeUser(0, 1500);
    const res = await executeSpin({ userId: user.id, wheelSlug: "pack-wheel" }); // leaves $5
    await expect(requestShipping(user.id, res.vault.id, ADDRESS)).rejects.toBeInstanceOf(InsufficientFundsError);
    expect(await testPrisma.order.count({ where: { userId: user.id } })).toBe(0);
    expect((await testPrisma.vaultItem.findUniqueOrThrow({ where: { id: res.vault.id } })).status).toBe("PENDING");
  });

  it("a real-money buyback credits the real balance", async () => {
    setRealMoney(true);
    const user = await makeUser(0, 10_000);
    const res = await executeSpin({ userId: user.id, wheelSlug: "pack-wheel" });
    const r = await sellBack(user.id, res.vault.id);
    const u = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(u.realBalanceCents).toBe(9000 + r.buybackCents);
    expect(u.demoBalanceCents).toBe(0);
  });

  describe("expiry job", () => {
    it("auto-sells expired items only, marks them autoDecided, and is idempotent", async () => {
      const user = await makeUser();
      const expired = await winItem(user.id);
      const fresh = await winItem(user.id);
      await testPrisma.vaultItem.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });

      const first = await processExpiredVaultItems();
      expect(first).toMatchObject({ examined: 1, sold: 1, held: 0 });
      const e = await testPrisma.vaultItem.findUniqueOrThrow({ where: { id: expired.id } });
      expect(e.status).toBe("SOLD");
      expect(e.autoDecided).toBe(true);
      expect(e.buybackCents).toBe(Math.round(expired.valueCents * 0.8));
      expect((await testPrisma.vaultItem.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe("PENDING");
      const u = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(u.demoBalanceCents).toBe(100_000 - 2000 + e.buybackCents!);

      const second = await processExpiredVaultItems();
      expect(second).toMatchObject({ examined: 0, sold: 0 });
      expect(await testPrisma.ledgerEntry.count({ where: { userId: user.id, type: "BUYBACK" } })).toBe(1);
    });

    it("with AUTO_SHIP_HOLD, expired items are held with no deadline and no money moves", async () => {
      await setSetting("vaultDefaultAction", "AUTO_SHIP_HOLD");
      const user = await makeUser();
      const item = await winItem(user.id);
      await testPrisma.vaultItem.update({ where: { id: item.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      const r = await processExpiredVaultItems({ userId: user.id });
      expect(r).toMatchObject({ sold: 0, held: 1 });
      const held = await testPrisma.vaultItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(held.status).toBe("HELD");
      expect(held.expiresAt).toBeNull();
      expect(held.autoDecided).toBe(true);
      expect(await testPrisma.ledgerEntry.count({ where: { userId: user.id, type: "BUYBACK" } })).toBe(0);
      // The user can still sell a held item later.
      const sold = await sellBack(user.id, item.id);
      expect(sold.item.status).toBe("SOLD");
      await setSetting("vaultDefaultAction", "AUTO_SELL");
    });

    it("a user deciding at the same moment as the job yields exactly one outcome", async () => {
      const user = await makeUser();
      const item = await winItem(user.id);
      await testPrisma.vaultItem.update({ where: { id: item.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await Promise.allSettled([processExpiredVaultItems(), sellBack(user.id, item.id), processExpiredVaultItems()]);
      expect(await testPrisma.ledgerEntry.count({ where: { userId: user.id, type: "BUYBACK" } })).toBe(1);
      expect((await testPrisma.vaultItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("SOLD");
    });

    it("scoped to one user when asked", async () => {
      const a = await makeUser();
      const b = await makeUser();
      const ia = await winItem(a.id);
      const ib = await winItem(b.id);
      await testPrisma.vaultItem.updateMany({ where: { id: { in: [ia.id, ib.id] } }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await processExpiredVaultItems({ userId: a.id });
      expect((await testPrisma.vaultItem.findUniqueOrThrow({ where: { id: ia.id } })).status).toBe("SOLD");
      expect((await testPrisma.vaultItem.findUniqueOrThrow({ where: { id: ib.id } })).status).toBe("PENDING");
    });
  });
});
