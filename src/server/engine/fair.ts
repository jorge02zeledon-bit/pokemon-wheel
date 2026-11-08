import { createHash, createHmac, randomBytes } from "node:crypto";
import { BPS_SCALE } from "@/lib/money";

/**
 * Provably fair primitives.
 *
 * Scheme (per spin):
 *   1. Before the spin, the server holds a random `serverSeed` and shows the
 *      user only `sha256(serverSeed)`.
 *   2. The user controls `clientSeed`; `nonce` increments per user per spin.
 *   3. resultHash = HMAC-SHA256(key = serverSeed, msg = `${clientSeed}:${nonce}`)
 *   4. tierRoll    = first 8 hex chars (32 bits) of resultHash as an integer, mod 10,000
 *      productRoll = next 6 hex chars (24 bits) as an integer; the product
 *                    within the winning tier is productRoll mod (product count)
 *
 * Bias notes: 2^32 mod 10,000 = 7,296, so tier rolls below 7,296 are favoured
 * by 1 part in ~429,000 (about 0.0002% of a 1% tier): negligible, and
 * documented on the Provably Fair page. Product choice uses 24 bits for at
 * most a handful of products, so its modulo bias is below 1 part in 1,000,000.
 *   5. After the spin the server reveals `serverSeed` and rotates to a new one.
 *
 * Anyone can recompute steps 3-4 from the revealed values and compare them with
 * the odds snapshot stored on the spin, so neither side can bias the result.
 *
 * Everything here is pure and side-effect free except the two generators,
 * which use the OS cryptographic RNG.
 */

export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function generateClientSeed(): string {
  return randomBytes(16).toString("hex");
}

export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed, "utf8").digest("hex");
}

export function computeResultHash(serverSeed: string, clientSeed: string, nonce: number): string {
  return createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}`, "utf8").digest("hex");
}

export interface FairRolls {
  resultHash: string;
  /** Integer in [0, 10000) used to select the tier against cumulative odds. */
  tierRoll: number;
  /** Non-negative 24-bit integer used to pick a product inside the tier. */
  productRoll: number;
}

/** Derive the two rolls from a result hash. Pure function. */
export function rollsFromHash(resultHash: string): FairRolls {
  const a = parseInt(resultHash.slice(0, 8), 16); // 32 bits
  const b = parseInt(resultHash.slice(8, 14), 16); // next 24 bits
  return { resultHash, tierRoll: a % BPS_SCALE, productRoll: b };
}

export function computeRolls(serverSeed: string, clientSeed: string, nonce: number): FairRolls {
  return rollsFromHash(computeResultHash(serverSeed, clientSeed, nonce));
}
