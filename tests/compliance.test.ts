import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, seedDb, testPrisma } from "./db";
import { assertDepositWithinLimits, getEffectiveLimits, setLimits } from "@/server/compliance/limits";
import { selfExclude, takeBreak, getActiveExclusion } from "@/server/compliance/exclusion";
import { applyVerificationUpdate, refreshVerification, startVerification, adminSetIdentityStatus } from "@/server/compliance/identity";
import { executeSpin } from "@/server/engine/spin";
import { applyLedgerEntry } from "@/server/wallet/ledger";
import { clearSettingsCache } from "@/server/settings";
import { hashServerSeed } from "@/server/engine/fair";
import { HeaderGeoProvider } from "@/server/providers/geo/HeaderGeoProvider";
import { MockGeoProvider } from "@/server/providers/geo/MockGeoProvider";

async function makeUser(demo = 100_000) {
  const seed = "d".repeat(64);
  const u = await testPrisma.user.create({ data: { email: `c${Math.random()}@t.local`, passwordHash: "x", stateCode: "CA", ageConfirmedAt: new Date(), clientSeed: "c", nextServerSeed: seed, nextServerSeedHash: hashServerSeed(seed) } });
  if (demo) await testPrisma.$transaction((tx) => applyLedgerEntry(tx, { userId: u.id, type: "DEMO_GRANT", amountCents: demo, isDemo: true }));
  return u;
}

describe("responsible play", () => {
  beforeAll(async () => { await resetDb(); seedDb(); });
  beforeEach(async () => { clearSettingsCache(); await testPrisma.product.updateMany({ data: { stock: 1000 } }); });

  it("stricter limits apply immediately; looser ones wait for the cooling-off period", async () => {
    const u = await makeUser();
    let r = await setLimits(u.id, { dailyDepositCents: 10_000 });
    expect(r.limits.dailyDepositCents).toBe(10_000);
    expect(r.pendingEffectiveAt).toBeNull();

    r = await setLimits(u.id, { dailyDepositCents: 5_000 }); // stricter -> now
    expect(r.limits.dailyDepositCents).toBe(5_000);

    r = await setLimits(u.id, { dailyDepositCents: 20_000 }); // looser -> pending
    expect(r.limits.dailyDepositCents).toBe(5_000);
    expect(r.pending.dailyDepositCents).toBe(20_000);
    expect(r.pendingEffectiveAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);

    r = await setLimits(u.id, { dailyDepositCents: null }); // removal -> pending
    expect(r.limits.dailyDepositCents).toBe(5_000);
    expect(r.pending.dailyDepositCents).toBeNull();

    // After the cooling-off period the pending change becomes effective.
    const later = new Date(Date.now() + 25 * 3_600_000);
    const eff = await getEffectiveLimits(testPrisma, u.id, later);
    expect(eff.limits.dailyDepositCents).toBeNull();
    expect(eff.pendingEffectiveAt).toBeNull();

    await expect(setLimits(u.id, { dailySpendCents: 50 })).rejects.toThrow(/at least/);
  });

  it("daily spend limit blocks spins once the 24h total would be exceeded (demo and real tracked separately)", async () => {
    const u = await makeUser();
    await setLimits(u.id, { dailySpendCents: 2500 });
    await executeSpin({ userId: u.id, wheelSlug: "pack-wheel" }); // $10
    await executeSpin({ userId: u.id, wheelSlug: "pack-wheel" }); // $20
    await expect(executeSpin({ userId: u.id, wheelSlug: "pack-wheel" })).rejects.toMatchObject({ reason: "SPEND_LIMIT" }); // would be $30
    const row = await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.demoBalanceCents).toBe(98_000);
  });

  it("deposit limits count rolling windows of successful and pending deposits", async () => {
    const u = await makeUser();
    await setLimits(u.id, { dailyDepositCents: 10_000, weeklyDepositCents: 15_000 });
    await testPrisma.deposit.create({ data: { userId: u.id, provider: "test", amountCents: 6_000, status: "SUCCEEDED" } });
    await testPrisma.deposit.create({ data: { userId: u.id, provider: "test", amountCents: 1_000, status: "FAILED" } }); // ignored
    await assertDepositWithinLimits(testPrisma, u.id, 4_000); // 10,000 exactly: ok
    await expect(assertDepositWithinLimits(testPrisma, u.id, 4_001)).rejects.toMatchObject({ reason: "DEPOSIT_LIMIT" });
    // Older than a day but inside the week counts against the weekly limit only.
    await testPrisma.deposit.create({ data: { userId: u.id, provider: "test", amountCents: 8_000, status: "SUCCEEDED", createdAt: new Date(Date.now() - 3 * 86_400_000) } });
    await expect(assertDepositWithinLimits(testPrisma, u.id, 2_000)).rejects.toThrow(/weekly/);
    await assertDepositWithinLimits(testPrisma, u.id, 1_000);
  });

  it("take a break blocks spins and cannot be shortened", async () => {
    const u = await makeUser();
    await expect(takeBreak(u.id, 5)).rejects.toThrow(/24, 72 or 168/);
    await takeBreak(u.id, 72);
    await expect(takeBreak(u.id, 24)).rejects.toThrow(/longer break/);
    await expect(executeSpin({ userId: u.id, wheelSlug: "pack-wheel" })).rejects.toMatchObject({ reason: "COOLDOWN" });
    await takeBreak(u.id, 168); // extending is allowed
  });

  it("self-exclusion requires confirmation, blocks spins, and can only be extended", async () => {
    const u = await makeUser();
    await expect(selfExclude(u.id, "DAYS_30", "yes")).rejects.toThrow(/EXCLUDE/);
    const ex = await selfExclude(u.id, "DAYS_30", "EXCLUDE");
    expect(ex.endsAt!.getTime() - Date.now()).toBeGreaterThan(29 * 86_400_000);
    await expect(executeSpin({ userId: u.id, wheelSlug: "pack-wheel" })).rejects.toMatchObject({ reason: "SELF_EXCLUDED" });
    await expect(selfExclude(u.id, "DAYS_30", "EXCLUDE")).rejects.toThrow(/already in place/);
    await selfExclude(u.id, "PERMANENT", "EXCLUDE");
    expect((await getActiveExclusion(u.id))?.duration).toBe("PERMANENT");
    await expect(selfExclude(u.id, "MONTHS_6", "EXCLUDE")).rejects.toThrow(/already in place/);
    // There is no user-facing path that deletes or shortens an exclusion.
  });
});

describe("identity verification (mock provider)", () => {
  beforeEach(() => { process.env.MOCK_IDENTITY_DELAY_SECONDS = "0"; delete process.env.MOCK_IDENTITY_OUTCOME; });
  afterEach(() => { delete process.env.MOCK_IDENTITY_DELAY_SECONDS; });

  it("starts pending, auto-approves on poll, and is idempotent", async () => {
    const u = await makeUser(0);
    const { verification } = await startVerification(u.id, "http://x/account");
    expect(verification.status).toBe("PENDING");
    expect((await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } })).identityStatus).toBe("PENDING");
    // Starting again while pending returns the same verification.
    expect((await startVerification(u.id, "http://x")).verification.id).toBe(verification.id);
    // A fresh provider instance with zero delay approves on poll.
    const { MockIdentityProvider } = await import("@/server/providers/identity/MockIdentityProvider");
    const upd = await new MockIdentityProvider().poll(verification.providerRef!, verification.createdAt);
    expect(upd?.status).toBe("APPROVED");
    await applyVerificationUpdate(upd!);
    await applyVerificationUpdate(upd!); // idempotent
    const r = await refreshVerification(u.id);
    expect(r.status).toBe("APPROVED");
    await expect(startVerification(u.id, "http://x")).rejects.toThrow(/already verified/);
  });

  it("admins can override with a reason, recorded in the audit log", async () => {
    const admin = await testPrisma.user.findUniqueOrThrow({ where: { email: "admin@test.local" } });
    const u = await makeUser(0);
    await expect(adminSetIdentityStatus(admin.id, u.id, "APPROVED", " ")).rejects.toThrow(/reason/);
    await adminSetIdentityStatus(admin.id, u.id, "REJECTED", "Document mismatch");
    expect((await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } })).identityStatus).toBe("REJECTED");
    expect(await testPrisma.adminAuditLog.count({ where: { action: "user.identity", entityId: u.id } })).toBe(1);
  });
});

describe("geo providers", () => {
  it("header provider reads Vercel and Cloudflare headers and ignores unknown regions", async () => {
    const p = new HeaderGeoProvider();
    expect(await p.lookup({ ip: null, headers: new Headers({ "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "WA" }) })).toMatchObject({ countryCode: "US", stateCode: "WA", source: "vercel" });
    expect(await p.lookup({ ip: null, headers: new Headers({ "cf-ipcountry": "US", "cf-region-code": "tx" }) })).toMatchObject({ countryCode: "US", stateCode: "TX", source: "cloudflare" });
    expect(await p.lookup({ ip: null, headers: new Headers({ "cf-ipcountry": "CA", "cf-region-code": "ON" }) })).toMatchObject({ countryCode: "CA", stateCode: null });
    expect(await p.lookup({ ip: null, headers: new Headers({ "x-vercel-ip-country": "XX" }) })).toMatchObject({ countryCode: null, stateCode: null });
    expect(await p.lookup({ ip: null, headers: new Headers() })).toMatchObject({ countryCode: null, stateCode: null });
  });

  it("mock provider only honours x-demo-state in demo mode", async () => {
    const p = new MockGeoProvider();
    process.env.REAL_MONEY_ENABLED = "false";
    expect((await p.lookup({ ip: null, headers: new Headers({ "x-demo-state": "nv" }) })).stateCode).toBe("NV");
    expect((await p.lookup({ ip: null, headers: new Headers({ "x-demo-state": "XX" }) })).countryCode).toBe("CA");
    process.env.REAL_MONEY_ENABLED = "true";
    expect((await p.lookup({ ip: null, headers: new Headers({ "x-demo-state": "NV" }) })).stateCode).toBeNull();
    process.env.REAL_MONEY_ENABLED = "false";
  });

  it("the engine refuses spins from outside the US and from blocked detected states", async () => {
    const u = await makeUser();
    await expect(executeSpin({ userId: u.id, wheelSlug: "pack-wheel", eligibility: { ipCountry: "CA" } })).rejects.toMatchObject({ reason: "OUTSIDE_US" });
    await expect(executeSpin({ userId: u.id, wheelSlug: "pack-wheel", eligibility: { ipCountry: "US", ipState: "MT" } })).rejects.toMatchObject({ reason: "BLOCKED_IP_STATE" });
    await executeSpin({ userId: u.id, wheelSlug: "pack-wheel", eligibility: { ipCountry: "US", ipState: "OR" } });
    await executeSpin({ userId: u.id, wheelSlug: "pack-wheel", eligibility: { ipCountry: null, ipState: null } }); // unknown location: stated state governs
  });
});
