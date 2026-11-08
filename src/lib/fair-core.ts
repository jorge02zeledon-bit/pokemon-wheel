/**
 * Browser-safe provably fair core: no Node imports, so the verification page
 * can run the exact same derivation in the user's browser.
 * The server module (src/server/engine/fair.ts) re-exports these.
 */
import { BPS_SCALE } from "./money";

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

/** The exact message that is HMAC'd with the server seed. */
export function fairMessage(clientSeed: string, nonce: number): string {
  return `${clientSeed}:${nonce}`;
}

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** SHA-256 using Web Crypto (browser and modern Node). */
export async function sha256HexWeb(input: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(input)));
}

/** HMAC-SHA256 using Web Crypto (browser and modern Node). */
export async function hmacSha256HexWeb(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}
