import { z } from "zod";
import type { Rarity } from "@prisma/client";

/**
 * The odds snapshot stored on every spin. It captures the wheel exactly as it
 * was when the spin happened (tiers in canonical order, products in canonical
 * order, odds and values), so a spin stays verifiable after the admin edits
 * the wheel. Verification only needs this snapshot plus the seeds and nonce.
 */
export const oddsSnapshotSchema = z.object({
  version: z.literal(1),
  wheel: z.object({ id: z.string(), slug: z.string(), name: z.string(), spinPriceCents: z.number().int() }),
  tiers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        rarity: z.enum(["COMMON", "UNCOMMON", "RARE", "CHASE"]),
        oddsBps: z.number().int().min(0).max(10_000),
        products: z
          .array(z.object({ id: z.string(), name: z.string(), valueCents: z.number().int() }))
          .min(1),
      }),
    )
    .min(1),
});

export type OddsSnapshot = z.infer<typeof oddsSnapshotSchema>;
export type SnapshotTier = OddsSnapshot["tiers"][number] & { rarity: Rarity };
