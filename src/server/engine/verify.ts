import { hashServerSeed, computeRolls } from "./fair";
import { selectIndex, selectTier } from "./odds";
import type { OddsSnapshot } from "./snapshot";

/**
 * Pure, dependency-free verification of a spin. Anyone can run this with the
 * values shown on the spin's verification page: it recomputes the result from
 * the revealed server seed, the client seed, the nonce and the odds snapshot.
 */
export interface VerifyInput {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  snapshot: OddsSnapshot;
}

export interface VerifyOutput {
  /** sha256(serverSeed) === serverSeedHash: the server committed to this seed before the spin. */
  seedHashMatches: boolean;
  resultHash: string;
  tierRoll: number;
  productRoll: number;
  tier: OddsSnapshot["tiers"][number];
  product: OddsSnapshot["tiers"][number]["products"][number];
  productIndex: number;
}

export function verifySpin(input: VerifyInput): VerifyOutput {
  const seedHashMatches = hashServerSeed(input.serverSeed) === input.serverSeedHash;
  const rolls = computeRolls(input.serverSeed, input.clientSeed, input.nonce);
  const tier = selectTier(input.snapshot.tiers, rolls.tierRoll);
  const productIndex = selectIndex(rolls.productRoll, tier.products.length);
  return {
    seedHashMatches,
    resultHash: rolls.resultHash,
    tierRoll: rolls.tierRoll,
    productRoll: rolls.productRoll,
    tier,
    product: tier.products[productIndex],
    productIndex,
  };
}
