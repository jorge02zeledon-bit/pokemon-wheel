import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, testPrisma } from "./db";
import { applyLedgerEntry, InsufficientFundsError } from "@/server/wallet/ledger";

async function makeUser() {
  return testPrisma.user.create({
    data: {
      email: `u${Date.now()}@test.local`,
      passwordHash: "x",
      clientSeed: "c",
      nextServerSeed: "s",
      nextServerSeedHash: "h",
    },
  });
}

describe("ledger", () => {
  beforeEach(resetDb);

  it("credits and debits the demo balance and records balanceAfter", async () => {
    const user = await makeUser();
    await testPrisma.$transaction(async (tx) => {
      await applyLedgerEntry(tx, { userId: user.id, type: "DEMO_GRANT", amountCents: 100_000, isDemo: true });
      await applyLedgerEntry(tx, { userId: user.id, type: "SPIN", amountCents: -1000, isDemo: true });
    });
    const after = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.demoBalanceCents).toBe(99_000);
    expect(after.realBalanceCents).toBe(0);
    const entries = await testPrisma.ledgerEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    expect(entries.map((e) => e.balanceAfterCents)).toEqual([100_000, 99_000]);
  });

  it("refuses debits that would overdraw and rolls back the transaction", async () => {
    const user = await makeUser();
    await expect(
      testPrisma.$transaction(async (tx) => {
        await applyLedgerEntry(tx, { userId: user.id, type: "DEMO_GRANT", amountCents: 500, isDemo: true });
        await applyLedgerEntry(tx, { userId: user.id, type: "SPIN", amountCents: -1000, isDemo: true });
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
    const after = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.demoBalanceCents).toBe(0);
    expect(await testPrisma.ledgerEntry.count()).toBe(0);
  });

  it("keeps demo and real balances separate", async () => {
    const user = await makeUser();
    await testPrisma.$transaction((tx) =>
      applyLedgerEntry(tx, { userId: user.id, type: "DEMO_GRANT", amountCents: 1000, isDemo: true }),
    );
    await expect(
      testPrisma.$transaction((tx) =>
        applyLedgerEntry(tx, { userId: user.id, type: "SPIN", amountCents: -1, isDemo: false }),
      ),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
  });

  it("ledger rows cannot be updated or deleted (database trigger)", async () => {
    const user = await makeUser();
    const entry = await testPrisma.$transaction((tx) =>
      applyLedgerEntry(tx, { userId: user.id, type: "DEMO_GRANT", amountCents: 1000, isDemo: true }),
    );
    await expect(testPrisma.ledgerEntry.update({ where: { id: entry.id }, data: { amountCents: 5 } })).rejects.toThrow(/append-only/);
    await expect(testPrisma.ledgerEntry.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);
  });

  it("spin rows cannot be updated or deleted (database trigger)", async () => {
    const user = await makeUser();
    const wheel = await testPrisma.wheel.create({ data: { slug: "w", name: "W", spinPriceCents: 100 } });
    const tier = await testPrisma.tier.create({ data: { wheelId: wheel.id, name: "T", rarity: "COMMON", oddsBps: 10000 } });
    const product = await testPrisma.product.create({ data: { slug: "p", name: "P", category: "OTHER", valueCents: 100, stock: 1 } });
    const spin = await testPrisma.spin.create({
      data: {
        userId: user.id, wheelId: wheel.id, tierId: tier.id, productId: product.id,
        spinPriceCents: 100, productValueCents: 100, isDemo: true,
        serverSeed: "s", serverSeedHash: "h", clientSeed: "c", nonce: 1, resultHash: "r",
        tierRoll: 0, productRoll: 0, oddsSnapshot: {},
      },
    });
    await expect(testPrisma.spin.update({ where: { id: spin.id }, data: { tierRoll: 1 } })).rejects.toThrow(/append-only/);
    await expect(testPrisma.spin.delete({ where: { id: spin.id } })).rejects.toThrow(/append-only/);
  });
});
