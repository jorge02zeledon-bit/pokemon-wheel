import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, testPrisma } from "./db";
import { updateProfile } from "@/server/account/profile";

describe("profile updates", () => {
  beforeEach(resetDb);
  it("sets a valid state and display name, rejects invalid values", async () => {
    const u = await testPrisma.user.create({ data: { email: "pr@t.local", passwordHash: "x", clientSeed: "c", nextServerSeed: "s", nextServerSeedHash: "h" } });
    expect(await updateProfile(u.id, { stateCode: "TX" })).toEqual({ displayName: null, stateCode: "TX" });
    expect((await updateProfile(u.id, { displayName: "Pat" })).displayName).toBe("Pat");
    await expect(updateProfile(u.id, { stateCode: "ZZ" })).rejects.toThrow(/valid US state/);
    await expect(updateProfile(u.id, { displayName: "x" })).rejects.toThrow(/too short/);
    expect((await testPrisma.user.findUniqueOrThrow({ where: { id: u.id } })).stateCode).toBe("TX");
  });
});
