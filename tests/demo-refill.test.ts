import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, testPrisma } from "./db";
import { getDemoRefillStatus, refillDemoCredits, RefillNotAvailableError } from "@/server/wallet/demo";
import { applyLedgerEntry } from "@/server/wallet/ledger";
import { clearSettingsCache } from "@/server/settings";

async function makeUser(balance: number, lastRefill: Date | null = null) {
  const u = await testPrisma.user.create({
    data: { email: `d${Math.random()}@t.local`, passwordHash: "x", clientSeed: "c", nextServerSeed: "s", nextServerSeedHash: "h", lastDemoRefillAt: lastRefill },
  });
  if (balance > 0) await testPrisma.$transaction((tx) => applyLedgerEntry(tx, { userId: u.id, type: "DEMO_GRANT", amountCents: balance, isDemo: true }));
  return u;
}

describe("demo credit refill", () => {
  beforeEach(async () => {
    await resetDb();
    clearSettingsCache();
  });

  it("grants the configured amount when the balance is low and no cooldown is active", async () => {
    const u = await makeUser(500);
    expect((await getDemoRefillStatus(u.id)).available).toBe(true);
    const r = await refillDemoCredits(u.id);
    expect(r.grantedCents).toBe(100_000);
    expect(r.balanceCents).toBe(100_500);
    const status = await getDemoRefillStatus(u.id);
    expect(status.available).toBe(false);
    expect(status.reason).toBe("BALANCE_TOO_HIGH");
  });

  it("refuses while the balance is still high", async () => {
    const u = await makeUser(100_000);
    await expect(refillDemoCredits(u.id)).rejects.toBeInstanceOf(RefillNotAvailableError);
  });

  it("enforces the cooldown since the last grant", async () => {
    const u = await makeUser(0, new Date(Date.now() - 3_600_000)); // refilled an hour ago, cooldown is 24h
    const status = await getDemoRefillStatus(u.id);
    expect(status.available).toBe(false);
    expect(status.reason).toBe("COOLDOWN");
    const err = await refillDemoCredits(u.id).catch((e) => e);
    expect(err).toBeInstanceOf(RefillNotAvailableError);
    expect(err.availableAt.getTime()).toBeGreaterThan(Date.now());

    const old = await makeUser(0, new Date(Date.now() - 25 * 3_600_000));
    expect((await refillDemoCredits(old.id)).balanceCents).toBe(100_000);
  });

  it("concurrent refill requests grant at most once", async () => {
    const u = await makeUser(0);
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => refillDemoCredits(u.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const row = await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.demoBalanceCents).toBe(100_000);
  });
});
