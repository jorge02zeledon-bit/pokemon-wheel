import { beforeEach, describe, expect, it } from "vitest";
import { compare } from "bcryptjs";
import { resetDb, testPrisma } from "./db";
import { requestPasswordReset, resetPassword } from "@/server/auth/password-reset";

describe("password reset", () => {
  beforeEach(resetDb);

  it("issues a hashed, single-use, expiring token and changes the password", async () => {
    const u = await testPrisma.user.create({ data: { email: "pw@t.local", passwordHash: "old", clientSeed: "c", nextServerSeed: "s", nextServerSeedHash: "h" } });
    await requestPasswordReset("PW@T.LOCAL", "http://localhost:3000");
    await requestPasswordReset("nobody@t.local", "http://localhost:3000"); // silent
    const rows = await testPrisma.passwordResetToken.findMany({ where: { userId: u.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toHaveLength(64); // never the raw token
    // We cannot read the raw token from the DB (by design); simulate the emailed link by issuing a known one.
    const { createHash } = await import("node:crypto");
    const raw = "test-raw-token";
    await testPrisma.passwordResetToken.create({ data: { userId: u.id, tokenHash: createHash("sha256").update(raw).digest("hex"), expiresAt: new Date(Date.now() + 60_000) } });
    await expect(resetPassword(raw, "short")).rejects.toThrow(/at least 10/);
    await resetPassword(raw, "a-much-better-password");
    const after = await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(await compare("a-much-better-password", after.passwordHash)).toBe(true);
    await expect(resetPassword(raw, "another-good-password")).rejects.toThrow(/invalid|used|expired/i);
    // Other outstanding tokens for the user are invalidated too.
    expect(await testPrisma.passwordResetToken.count({ where: { userId: u.id, usedAt: null } })).toBe(0);
  });

  it("rejects expired and unknown tokens", async () => {
    const u = await testPrisma.user.create({ data: { email: "pw2@t.local", passwordHash: "old", clientSeed: "c", nextServerSeed: "s", nextServerSeedHash: "h" } });
    const { createHash } = await import("node:crypto");
    await testPrisma.passwordResetToken.create({ data: { userId: u.id, tokenHash: createHash("sha256").update("expired").digest("hex"), expiresAt: new Date(Date.now() - 1000) } });
    await expect(resetPassword("expired", "a-much-better-password")).rejects.toThrow(/expired/);
    await expect(resetPassword("nope", "a-much-better-password")).rejects.toThrow(/invalid/);
  });
});
