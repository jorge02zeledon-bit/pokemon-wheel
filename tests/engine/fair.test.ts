import { describe, expect, it } from "vitest";
import { computeResultHash, computeRolls, generateClientSeed, generateServerSeed, hashServerSeed, rollsFromHash } from "@/server/engine/fair";

describe("provably fair primitives", () => {
  it("generates distinct high-entropy seeds", () => {
    const seeds = new Set(Array.from({ length: 50 }, generateServerSeed));
    expect(seeds.size).toBe(50);
    expect(generateServerSeed()).toMatch(/^[0-9a-f]{64}$/);
    expect(generateClientSeed()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("hashes server seeds deterministically with SHA-256", () => {
    expect(hashServerSeed("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("derives rolls deterministically from seeds and nonce", () => {
    const a = computeRolls("server", "client", 1);
    const b = computeRolls("server", "client", 1);
    const c = computeRolls("server", "client", 2);
    expect(a).toEqual(b);
    expect(a.resultHash).not.toEqual(c.resultHash);
    expect(a.tierRoll).toBeGreaterThanOrEqual(0);
    expect(a.tierRoll).toBeLessThan(10_000);
    expect(a.resultHash).toBe(computeResultHash("server", "client", 1));
  });

  it("maps a known hash to known rolls", () => {
    const hash = "0000270f" + "000005" + "0".repeat(50); // 9999, 5
    expect(rollsFromHash(hash)).toEqual({ resultHash: hash, tierRoll: 9999, productRoll: 5 });
    const hash2 = "00002710" + "ffffff" + "0".repeat(50); // 10000 -> wraps to 0
    expect(rollsFromHash(hash2).tierRoll).toBe(0);
    expect(rollsFromHash(hash2).productRoll).toBe(0xffffff);
    const hash3 = "ffffffff" + "000000" + "0".repeat(50); // 2^32-1 mod 10000 = 7295
    expect(rollsFromHash(hash3).tierRoll).toBe(7295);
  });
});
