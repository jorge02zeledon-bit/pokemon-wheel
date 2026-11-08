import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, seedDb, testPrisma } from "../db";
import { executeSpin, getFairState, setClientSeed } from "@/server/engine/spin";
import { NotEligibleError, OutOfStockError, WheelUnavailableError } from "@/server/engine/errors";
import { InsufficientFundsError, applyLedgerEntry } from "@/server/wallet/ledger";
import { hashServerSeed } from "@/server/engine/fair";
import { verifySpin } from "@/server/engine/verify";
import { oddsSnapshotSchema } from "@/server/engine/snapshot";
import { clearSettingsCache } from "@/server/settings";

/**
 * Integration tests for the spin engine against the real database. The
 * database starts from the real seed before each test.
 */

async function makeUser(opts: { balance?: number; stateCode?: string | null; ageConfirmed?: boolean } = {}) {
  const serverSeed = "a".repeat(64);
  const user = await testPrisma.user.create({
    data: {
      email: `spin-${Math.random().toString(36).slice(2)}@test.local`,
      passwordHash: "x",
      stateCode: opts.stateCode === undefined ? "CA" : opts.stateCode,
      ageConfirmedAt: opts.ageConfirmed === false ? null : new Date(),
      clientSeed: "test-client-seed",
      nextServerSeed: serverSeed,
      nextServerSeedHash: hashServerSeed(serverSeed),
    },
  });
  const balance = opts.balance ?? 100_000;
  if (balance > 0) {
    await testPrisma.$transaction((tx) =>
      applyLedgerEntry(tx, { userId: user.id, type: "DEMO_GRANT", amountCents: balance, isDemo: true }),
    );
  }
  return user;
}

async function setStock(slug: string, stock: number) {
  await testPrisma.product.update({ where: { slug }, data: { stock } });
}

describe("spin engine", () => {
  beforeAll(async () => {
    await resetDb();
    seedDb();
  });
  beforeEach(async () => {
    clearSettingsCache();
    // Fresh users per test; wheels/products come from the seed. Reset stock that tests may change.
    await testPrisma.product.updateMany({ data: { stock: 1000, isActive: true } });
    await testPrisma.wheel.updateMany({ data: { isActive: true } });
  });

  it("performs a complete spin: charge, reserve stock, audit row, vault item, seed rotation", async () => {
    const user = await makeUser();
    const before = await getFairState(user.id);
    const res = await executeSpin({ userId: user.id, wheelSlug: "pack-wheel" });

    // Charged exactly the spin price from the demo balance.
    expect(res.isDemo).toBe(true);
    expect(res.balanceAfterCents).toBe(100_000 - 1000);
    const u = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(u.demoBalanceCents).toBe(99_000);
    expect(u.realBalanceCents).toBe(0);

    // Commitment: the revealed seed hashes to the hash shown before the spin.
    expect(res.fair.serverSeedHash).toBe(before.nextServerSeedHash);
    expect(hashServerSeed(res.fair.serverSeed)).toBe(res.fair.serverSeedHash);
    expect(res.fair.nonce).toBe(before.nextNonce);
    expect(res.fair.clientSeed).toBe("test-client-seed");

    // Seed rotated: new hash differs and matches the user's stored next seed.
    expect(u.nonce).toBe(1);
    expect(u.nextServerSeedHash).toBe(res.fair.nextServerSeedHash);
    expect(u.nextServerSeedHash).not.toBe(res.fair.serverSeedHash);
    expect(hashServerSeed(u.nextServerSeed)).toBe(u.nextServerSeedHash);

    // Stock reserved for the won product only.
    const won = await testPrisma.product.findUniqueOrThrow({ where: { id: res.product.id } });
    expect(won.stock).toBe(999);
    const others = await testPrisma.product.findMany({ where: { id: { not: res.product.id } } });
    expect(others.every((p) => p.stock === 1000)).toBe(true);

    // Immutable audit row with snapshot; vault item pending with a 7-day deadline.
    const spin = await testPrisma.spin.findUniqueOrThrow({ where: { id: res.spinId } });
    expect(spin.tierId).toBe(res.tier.id);
    expect(spin.productId).toBe(res.product.id);
    expect(spin.spinPriceCents).toBe(1000);
    expect(spin.productValueCents).toBe(res.product.valueCents);
    const snapshot = oddsSnapshotSchema.parse(spin.oddsSnapshot);
    expect(snapshot.tiers.map((t) => t.oddsBps)).toEqual([8000, 1000, 800, 200]);
    const vault = await testPrisma.vaultItem.findUniqueOrThrow({ where: { spinId: spin.id } });
    expect(vault.status).toBe("PENDING");
    expect(vault.valueCents).toBe(res.product.valueCents);
    const days = (vault.expiresAt!.getTime() - spin.createdAt.getTime()) / 86_400_000;
    expect(days).toBeCloseTo(7, 5);

    // Ledger entry references the spin.
    const ledger = await testPrisma.ledgerEntry.findMany({ where: { userId: user.id, type: "SPIN" } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amountCents).toBe(-1000);
    expect(ledger[0].balanceAfterCents).toBe(99_000);
  });

  it("outcomes are reproducible by the public verifier", async () => {
    const user = await makeUser({ balance: 500_000 });
    for (let i = 0; i < 25; i++) {
      const res = await executeSpin({ userId: user.id, wheelSlug: "japanese-box-wheel" });
      const spin = await testPrisma.spin.findUniqueOrThrow({ where: { id: res.spinId } });
      const v = verifySpin({
        serverSeed: spin.serverSeed,
        serverSeedHash: spin.serverSeedHash,
        clientSeed: spin.clientSeed,
        nonce: spin.nonce,
        snapshot: oddsSnapshotSchema.parse(spin.oddsSnapshot),
      });
      expect(v.seedHashMatches).toBe(true);
      expect(v.resultHash).toBe(spin.resultHash);
      expect(v.tier.id).toBe(spin.tierId);
      expect(v.product.id).toBe(spin.productId);
      expect(spin.nonce).toBe(i + 1);
    }
    // A tampered seed fails verification.
    const spin = await testPrisma.spin.findFirstOrThrow({ where: { userId: user.id } });
    const bad = verifySpin({
      serverSeed: "not-the-real-seed",
      serverSeedHash: spin.serverSeedHash,
      clientSeed: spin.clientSeed,
      nonce: spin.nonce,
      snapshot: oddsSnapshotSchema.parse(spin.oddsSnapshot),
    });
    expect(bad.seedHashMatches).toBe(false);
  });

  it("refuses the spin and charges nothing when funds are insufficient", async () => {
    const user = await makeUser({ balance: 999 });
    await expect(executeSpin({ userId: user.id, wheelSlug: "pack-wheel" })).rejects.toBeInstanceOf(InsufficientFundsError);
    const u = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(u.demoBalanceCents).toBe(999);
    expect(u.nonce).toBe(0);
    expect(await testPrisma.spin.count({ where: { userId: user.id } })).toBe(0);
    expect((await testPrisma.product.findMany()).every((p) => p.stock === 1000)).toBe(true);
  });

  it("refuses to spin when ANY awardable product is out of stock, including the chase prize", async () => {
    const user = await makeUser();
    await setStock("evolving-skies-booster-pack", 0); // 2% chase on the pack wheel
    const err = await executeSpin({ userId: user.id, wheelSlug: "pack-wheel" }).catch((e) => e);
    expect(err).toBeInstanceOf(OutOfStockError);
    expect(err.productNames).toEqual(["Evolving Skies Booster Pack"]);
    const u = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(u.demoBalanceCents).toBe(100_000);
    expect(await testPrisma.spin.count({ where: { userId: user.id } })).toBe(0);
  });

  it("shared products: stock reserved on one wheel is gone from the other", async () => {
    // The 151 ETB is the Tin wheel chase and an ETB wheel rare product.
    await setStock("sv-151-etb", 0);
    const user = await makeUser();
    await expect(executeSpin({ userId: user.id, wheelSlug: "tin-collection-wheel" })).rejects.toBeInstanceOf(OutOfStockError);
    await expect(executeSpin({ userId: user.id, wheelSlug: "etb-wheel" })).rejects.toBeInstanceOf(OutOfStockError);
  });

  it("refuses inactive, unknown and misconfigured wheels", async () => {
    const user = await makeUser();
    await expect(executeSpin({ userId: user.id, wheelSlug: "nope" })).rejects.toBeInstanceOf(WheelUnavailableError);
    await testPrisma.wheel.update({ where: { slug: "pack-wheel" }, data: { isActive: false } });
    await expect(executeSpin({ userId: user.id, wheelSlug: "pack-wheel" })).rejects.toBeInstanceOf(WheelUnavailableError);

    // Odds not summing to 100%.
    const wheel = await testPrisma.wheel.findUniqueOrThrow({ where: { slug: "etb-wheel" }, include: { tiers: true } });
    const chase = wheel.tiers.find((t) => t.rarity === "CHASE")!;
    await testPrisma.tier.update({ where: { id: chase.id }, data: { oddsBps: 50 } });
    await expect(executeSpin({ userId: user.id, wheelSlug: "etb-wheel" })).rejects.toThrow(/100%/);
    await testPrisma.tier.update({ where: { id: chase.id }, data: { oddsBps: 100 } });
    expect(await testPrisma.spin.count({ where: { userId: user.id } })).toBe(0);
  });

  it("enforces compliance: age, state, blocked states, self-exclusion, cooldown", async () => {
    const noAge = await makeUser({ ageConfirmed: false });
    await expect(executeSpin({ userId: noAge.id, wheelSlug: "pack-wheel" })).rejects.toMatchObject({ reason: "AGE_NOT_CONFIRMED" });

    const noState = await makeUser({ stateCode: null });
    await expect(executeSpin({ userId: noState.id, wheelSlug: "pack-wheel" })).rejects.toMatchObject({ reason: "NO_STATE" });

    const nevada = await makeUser({ stateCode: "NV" });
    await expect(executeSpin({ userId: nevada.id, wheelSlug: "pack-wheel" })).rejects.toMatchObject({ reason: "BLOCKED_STATE" });

    const traveller = await makeUser({ stateCode: "CA" });
    await expect(
      executeSpin({ userId: traveller.id, wheelSlug: "pack-wheel", eligibility: { ipState: "WA" } }),
    ).rejects.toMatchObject({ reason: "BLOCKED_IP_STATE" });
    // Same user from an allowed location spins fine.
    await executeSpin({ userId: traveller.id, wheelSlug: "pack-wheel", eligibility: { ipState: "OR" } });

    const excluded = await makeUser();
    await testPrisma.selfExclusion.create({ data: { userId: excluded.id, duration: "PERMANENT" } });
    await expect(executeSpin({ userId: excluded.id, wheelSlug: "pack-wheel" })).rejects.toMatchObject({ reason: "SELF_EXCLUDED" });

    const expiredExclusion = await makeUser();
    await testPrisma.selfExclusion.create({
      data: { userId: expiredExclusion.id, duration: "DAYS_30", startsAt: new Date(Date.now() - 40 * 86_400_000), endsAt: new Date(Date.now() - 10 * 86_400_000) },
    });
    await executeSpin({ userId: expiredExclusion.id, wheelSlug: "pack-wheel" }); // allowed again

    const resting = await makeUser();
    await testPrisma.user.update({ where: { id: resting.id }, data: { cooldownUntil: new Date(Date.now() + 3_600_000) } });
    const err = await executeSpin({ userId: resting.id, wheelSlug: "pack-wheel" }).catch((e) => e);
    expect(err).toBeInstanceOf(NotEligibleError);
    expect(err.reason).toBe("COOLDOWN");
    expect(err.until).toBeInstanceOf(Date);

    // None of the refused users were charged or recorded.
    for (const u of [noAge, noState, nevada, excluded, resting]) {
      const row = await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(row.demoBalanceCents).toBe(100_000);
      expect(await testPrisma.spin.count({ where: { userId: u.id } })).toBe(0);
    }
  });

  it("stays consistent under concurrent spins from the same user", async () => {
    const user = await makeUser({ balance: 20 * 1000 });
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, () => executeSpin({ userId: user.id, wheelSlug: "pack-wheel" })),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(20); // exactly what the balance allowed
    expect(failed.every((r) => r.reason instanceof InsufficientFundsError)).toBe(true);

    const u = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(u.demoBalanceCents).toBe(0);
    expect(u.nonce).toBe(20);
    const spins = await testPrisma.spin.findMany({ where: { userId: user.id } });
    expect(new Set(spins.map((s) => s.nonce)).size).toBe(20); // nonces unique and sequential
    expect(new Set(spins.map((s) => s.serverSeedHash)).size).toBe(20); // a fresh commitment per spin

    // Stock accounting matches awards exactly.
    const awarded = new Map<string, number>();
    for (const s of spins) awarded.set(s.productId, (awarded.get(s.productId) ?? 0) + 1);
    for (const [productId, n] of awarded) {
      const p = await testPrisma.product.findUniqueOrThrow({ where: { id: productId } });
      expect(p.stock).toBe(1000 - n);
    }
  });

  it("never over-allocates a single remaining unit under concurrent spins from many users", async () => {
    // Make the pack wheel's common tier the only possible outcome by giving it 1 unit:
    // spins must stop after one award even though 10 users race for it.
    await testPrisma.product.updateMany({ data: { stock: 100 } });
    await setStock("current-english-booster-pack", 1);
    const users = await Promise.all(Array.from({ length: 10 }, () => makeUser()));
    const results = await Promise.allSettled(users.map((u) => executeSpin({ userId: u.id, wheelSlug: "pack-wheel" })));
    const wins = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof executeSpin>>>[];
    const commonWins = wins.filter((w) => w.value.product.name === "Current English Expansion Booster Pack");
    expect(commonWins.length).toBeLessThanOrEqual(1);
    const common = await testPrisma.product.findUniqueOrThrow({ where: { slug: "current-english-booster-pack" } });
    expect(common.stock).toBe(1 - commonWins.length);
    // Once the single unit is gone, every later spin is refused as out of stock (never a negative stock).
    const refused = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(refused.every((r) => r.reason instanceof OutOfStockError)).toBe(true);
    expect(common.stock).toBeGreaterThanOrEqual(0);
  });

  it("lets the user change their client seed without changing the committed server seed", async () => {
    const user = await makeUser();
    const before = await getFairState(user.id);
    await expect(setClientSeed(user.id, "short")).rejects.toThrow(/8-64/);
    await setClientSeed(user.id, "my-lucky-seed-2026");
    const after = await getFairState(user.id);
    expect(after.clientSeed).toBe("my-lucky-seed-2026");
    expect(after.nextServerSeedHash).toBe(before.nextServerSeedHash);
    const res = await executeSpin({ userId: user.id, wheelSlug: "pack-wheel" });
    expect(res.fair.clientSeed).toBe("my-lucky-seed-2026");
    expect(res.fair.serverSeedHash).toBe(before.nextServerSeedHash);
  });
});
