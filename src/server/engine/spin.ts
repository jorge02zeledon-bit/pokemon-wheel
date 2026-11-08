import { Prisma, type Rarity } from "@prisma/client";
import { prisma } from "../db";
import { isDemoMode } from "../config";
import { getSettings } from "../settings";
import { applyLedgerEntry } from "../wallet/ledger";
import { computeRolls, generateServerSeed, hashServerSeed } from "./fair";
import { oddsSumToOneHundred, selectIndex, selectTier } from "./odds";
import { assertSpinEligible, type EligibilityContext } from "./eligibility";
import { OutOfStockError, WheelUnavailableError } from "./errors";
import type { OddsSnapshot } from "./snapshot";

/**
 * The spin engine.
 *
 * `executeSpin` performs one spin as a single database transaction:
 *
 *   1. lock the user row (serialises the user's nonce and balance)
 *   2. load the wheel in canonical order and validate its configuration
 *   3. compliance checks (age, state, exclusion, cooldown)
 *   4. lock every product the wheel can award and require stock >= 1 for all
 *   5. debit the spin price (demo or real balance, never negative)
 *   6. roll: HMAC(serverSeed, clientSeed:nonce) -> tier -> product
 *   7. reserve one unit of the won product (conditional decrement)
 *   8. write the immutable Spin row with the odds snapshot
 *   9. create the vault item
 *  10. rotate the user's server seed and bump the nonce
 *
 * If anything fails the whole transaction rolls back: no charge, no stock
 * change, no spin record. All randomness comes from `generateServerSeed`
 * (OS CSPRNG) that was committed to before the spin, so the outcome can be
 * independently verified and the client never influences it.
 */

export interface SpinRequest {
  userId: string;
  wheelSlug: string;
  eligibility?: EligibilityContext;
}

export interface SpinResult {
  spinId: string;
  isDemo: boolean;
  wheel: { id: string; slug: string; name: string; spinPriceCents: number };
  tier: { id: string; name: string; rarity: Rarity; oddsBps: number; color: string };
  product: { id: string; name: string; valueCents: number; imageUrl: string | null };
  fair: {
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    resultHash: string;
    tierRoll: number;
    productRoll: number;
    /** Hash of the seed that will be used for this user's NEXT spin. */
    nextServerSeedHash: string;
  };
  balanceAfterCents: number;
  vault: { id: string; expiresAt: Date | null };
  createdAt: Date;
}

const WHEEL_INCLUDE = {
  tiers: {
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
    include: { products: { orderBy: { productId: "asc" as const }, include: { product: true } } },
  },
};

export async function executeSpin(req: SpinRequest): Promise<SpinResult> {
  const settings = await getSettings();
  const isDemo = isDemoMode();

  return prisma.$transaction(
    async (tx) => {
      // 1. Lock the user row for the duration of the transaction.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "id" = ${req.userId} FOR UPDATE`;
      if (locked.length !== 1) throw new Error("User not found");
      const user = await tx.user.findUniqueOrThrow({ where: { id: req.userId } });

      // 2. Load and validate the wheel.
      const wheel = await tx.wheel.findUnique({ where: { slug: req.wheelSlug }, include: WHEEL_INCLUDE });
      if (!wheel || !wheel.isActive) throw new WheelUnavailableError("This wheel does not exist or is not active");
      if (wheel.tiers.length === 0 || !oddsSumToOneHundred(wheel.tiers)) {
        throw new WheelUnavailableError("This wheel is misconfigured (odds do not total 100%)");
      }
      // Tiers with 0% odds are retired: they stay in the database because past
      // spins reference them, but they can never be selected and do not block play.
      const liveTiers = wheel.tiers.filter((t) => t.oddsBps > 0);
      if (liveTiers.some((t) => t.products.length === 0)) {
        throw new WheelUnavailableError("This wheel is misconfigured (a tier has no products)");
      }

      // 3. Compliance.
      await assertSpinEligible(tx, user, req.eligibility);

      // 4. Lock every awardable product (ordered by id to avoid deadlocks) and
      //    require all of them to be in stock, including the chase prize.
      const productIds = [...new Set(liveTiers.flatMap((t) => t.products.map((p) => p.productId)))].sort();
      const stocks = await tx.$queryRaw<{ id: string; stock: number; name: string; isActive: boolean }[]>`
        SELECT "id", "stock", "name", "isActive" FROM "Product"
        WHERE "id" IN (${Prisma.join(productIds)})
        ORDER BY "id" FOR UPDATE`;
      const missing = stocks.filter((p) => p.stock < 1 || !p.isActive).map((p) => p.name);
      if (missing.length > 0 || stocks.length !== productIds.length) throw new OutOfStockError(missing);

      // 5. Charge for the spin.
      const nonce = user.nonce + 1;
      const debit = await applyLedgerEntry(tx, {
        userId: user.id,
        type: "SPIN",
        amountCents: -wheel.spinPriceCents,
        isDemo,
        referenceType: "WHEEL",
        referenceId: wheel.id,
        description: `Spin: ${wheel.name} (#${nonce})`,
      });

      // 6. Roll. The server seed was committed (hash shown to the user) before this spin.
      const serverSeed = user.nextServerSeed;
      const serverSeedHash = user.nextServerSeedHash;
      if (hashServerSeed(serverSeed) !== serverSeedHash) {
        // Should be impossible; refuse rather than spin with a broken commitment.
        throw new Error("Server seed commitment mismatch");
      }
      const rolls = computeRolls(serverSeed, user.clientSeed, nonce);
      const tier = selectTier(wheel.tiers, rolls.tierRoll);
      const productIndex = selectIndex(rolls.productRoll, tier.products.length);
      const product = tier.products[productIndex].product;

      // 7. Reserve the unit. Conditional so a concurrent award can never over-allocate.
      const reserved = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: 1 } },
        data: { stock: { decrement: 1 } },
      });
      if (reserved.count !== 1) throw new OutOfStockError([product.name]);

      // 8. Immutable audit record.
      const snapshot: OddsSnapshot = {
        version: 1,
        wheel: { id: wheel.id, slug: wheel.slug, name: wheel.name, spinPriceCents: wheel.spinPriceCents },
        tiers: wheel.tiers.map((t) => ({
          id: t.id,
          name: t.name,
          rarity: t.rarity,
          oddsBps: t.oddsBps,
          products: t.products.map((tp) => ({ id: tp.product.id, name: tp.product.name, valueCents: tp.product.valueCents })),
        })),
      };
      const spin = await tx.spin.create({
        data: {
          userId: user.id,
          wheelId: wheel.id,
          tierId: tier.id,
          productId: product.id,
          spinPriceCents: wheel.spinPriceCents,
          productValueCents: product.valueCents,
          isDemo,
          serverSeed,
          serverSeedHash,
          clientSeed: user.clientSeed,
          nonce,
          resultHash: rolls.resultHash,
          tierRoll: rolls.tierRoll,
          productRoll: rolls.productRoll,
          oddsSnapshot: snapshot,
          ipState: req.eligibility?.ipState ?? null,
        },
      });

      // 9. Vault item with the decision deadline.
      const expiresAt = new Date(spin.createdAt.getTime() + settings.vaultWindowDays * 24 * 60 * 60 * 1000);
      const vault = await tx.vaultItem.create({
        data: {
          userId: user.id,
          spinId: spin.id,
          productId: product.id,
          valueCents: product.valueCents,
          isDemo,
          status: "PENDING",
          expiresAt,
        },
      });

      // 10. Rotate the commitment for the next spin.
      const nextServerSeed = generateServerSeed();
      const nextServerSeedHash = hashServerSeed(nextServerSeed);
      await tx.user.update({
        where: { id: user.id },
        data: { nonce, nextServerSeed, nextServerSeedHash },
      });

      return {
        spinId: spin.id,
        isDemo,
        wheel: { id: wheel.id, slug: wheel.slug, name: wheel.name, spinPriceCents: wheel.spinPriceCents },
        tier: { id: tier.id, name: tier.name, rarity: tier.rarity, oddsBps: tier.oddsBps, color: tier.color },
        product: { id: product.id, name: product.name, valueCents: product.valueCents, imageUrl: product.imageUrl },
        fair: {
          serverSeed,
          serverSeedHash,
          clientSeed: user.clientSeed,
          nonce,
          resultHash: rolls.resultHash,
          tierRoll: rolls.tierRoll,
          productRoll: rolls.productRoll,
          nextServerSeedHash,
        },
        balanceAfterCents: debit.balanceAfterCents,
        vault: { id: vault.id, expiresAt: vault.expiresAt },
        createdAt: spin.createdAt,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5_000, timeout: 15_000 },
  );
}

/** Client seeds: 8-64 URL-safe characters. */
export const CLIENT_SEED_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Let the user change their client seed. Takes effect from the next spin.
 * Changing it does not affect the committed server seed, so the user cannot
 * "fish" for a better result: the server seed hash stays the same.
 */
export async function setClientSeed(userId: string, clientSeed: string) {
  if (!CLIENT_SEED_PATTERN.test(clientSeed)) {
    throw new WheelUnavailableError("Client seed must be 8-64 letters, numbers, '-' or '_'");
  }
  await prisma.user.update({ where: { id: userId }, data: { clientSeed } });
}

/** What the user sees before spinning: the commitment for their next spin. */
export async function getFairState(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { clientSeed: true, nonce: true, nextServerSeedHash: true },
  });
  return { clientSeed: u.clientSeed, nextNonce: u.nonce + 1, nextServerSeedHash: u.nextServerSeedHash };
}
