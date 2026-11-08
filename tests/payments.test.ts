import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, seedDb, testPrisma } from "./db";
import { createDeposit, settleDeposit } from "@/server/wallet/deposits";
import { createWithdrawal, finalizeWithdrawal } from "@/server/wallet/withdrawals";
import { setLimits } from "@/server/compliance/limits";
import { selfExclude } from "@/server/compliance/exclusion";
import { RealMoneyDisabledError } from "@/server/errors";
import { InsufficientFundsError } from "@/server/wallet/ledger";
import { clearSettingsCache } from "@/server/settings";

async function makeUser(identity: "APPROVED" | "NOT_STARTED" = "APPROVED") {
  return testPrisma.user.create({ data: { email: `p${Math.random()}@t.local`, passwordHash: "x", stateCode: "CA", ageConfirmedAt: new Date(), identityStatus: identity, clientSeed: "c", nextServerSeed: "s", nextServerSeedHash: "h" } });
}
const balance = async (id: string) => (await testPrisma.user.findUniqueOrThrow({ where: { id } })).realBalanceCents;

describe("deposits and withdrawals (test payment provider)", () => {
  beforeAll(async () => { await resetDb(); seedDb(); });
  beforeEach(() => { clearSettingsCache(); process.env.REAL_MONEY_ENABLED = "true"; delete process.env.TEST_PAYMENT_FAIL; });
  afterEach(() => { process.env.REAL_MONEY_ENABLED = "false"; });

  it("every real-money entry point is closed in demo mode", async () => {
    process.env.REAL_MONEY_ENABLED = "false";
    const u = await makeUser();
    await expect(createDeposit(u.id, 5000, "http://x")).rejects.toBeInstanceOf(RealMoneyDisabledError);
    await expect(createWithdrawal(u.id, 5000, {})).rejects.toBeInstanceOf(RealMoneyDisabledError);
    expect(await testPrisma.deposit.count({ where: { userId: u.id } })).toBe(0);
  });

  it("deposits require identity verification", async () => {
    const u = await makeUser("NOT_STARTED");
    await expect(createDeposit(u.id, 5000, "http://x")).rejects.toMatchObject({ reason: "IDENTITY_REQUIRED" });
  });

  it("a successful deposit credits the real balance exactly once", async () => {
    const u = await makeUser();
    const { deposit } = await createDeposit(u.id, 5000, "http://x");
    expect(deposit.status).toBe("SUCCEEDED");
    expect(await balance(u.id)).toBe(5000);
    await settleDeposit(deposit.id, "SUCCEEDED"); // duplicate webhook
    expect(await balance(u.id)).toBe(5000);
    const entries = await testPrisma.ledgerEntry.findMany({ where: { userId: u.id, type: "DEPOSIT" } });
    expect(entries).toHaveLength(1);
    expect(entries[0].isDemo).toBe(false);
  });

  it("a failed deposit credits nothing", async () => {
    process.env.TEST_PAYMENT_FAIL = "true";
    const u = await makeUser();
    const { deposit } = await createDeposit(u.id, 5000, "http://x");
    expect(deposit.status).toBe("FAILED");
    expect(await balance(u.id)).toBe(0);
  });

  it("enforces amount bounds, deposit limits and self-exclusion", async () => {
    const u = await makeUser();
    await expect(createDeposit(u.id, 500, "http://x")).rejects.toThrow(/between/);
    await setLimits(u.id, { dailyDepositCents: 6000 });
    await createDeposit(u.id, 4000, "http://x");
    await expect(createDeposit(u.id, 3000, "http://x")).rejects.toMatchObject({ reason: "DEPOSIT_LIMIT" });
    expect(await balance(u.id)).toBe(4000);
    await selfExclude(u.id, "DAYS_30", "EXCLUDE");
    await expect(createDeposit(u.id, 1000, "http://x")).rejects.toMatchObject({ reason: "SELF_EXCLUDED" });
  });

  it("withdrawals hold funds immediately, refund on failure, and never touch demo credits", async () => {
    const u = await makeUser();
    await createDeposit(u.id, 10_000, "http://x");
    await expect(createWithdrawal(u.id, 1000, {})).rejects.toThrow(/Minimum/);
    await expect(createWithdrawal(u.id, 20_000, {})).rejects.toBeInstanceOf(InsufficientFundsError);
    const w = await createWithdrawal(u.id, 6000, { method: "test" });
    expect(w.status).toBe("PENDING");
    expect(await balance(u.id)).toBe(4000); // held
    await finalizeWithdrawal(w.id, "FAILED");
    expect(await balance(u.id)).toBe(10_000); // refunded
    await finalizeWithdrawal(w.id, "FAILED"); // idempotent
    expect(await balance(u.id)).toBe(10_000);
    const w2 = await createWithdrawal(u.id, 2000, {});
    await finalizeWithdrawal(w2.id, "SUCCEEDED");
    expect(await balance(u.id)).toBe(8000);
    expect((await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } })).demoBalanceCents).toBe(0);
  });

  it("withdrawals require identity verification", async () => {
    const u = await makeUser("NOT_STARTED");
    await expect(createWithdrawal(u.id, 5000, {})).rejects.toMatchObject({ reason: "IDENTITY_REQUIRED" });
  });
});
