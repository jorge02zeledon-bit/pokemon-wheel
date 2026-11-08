import { prisma } from "../db";
import { getSettings } from "../settings";
import { sellBackInTx } from "./decisions";

/**
 * Applies the configured default action to vault items whose decision window
 * has closed. Safe to run from a cron job, on demand, or lazily when a user
 * opens their vault (pass `userId`). Each item is handled in its own short
 * transaction with the row locked, so a user clicking "sell" at the same
 * moment produces exactly one outcome.
 */
export async function processExpiredVaultItems(opts: { now?: Date; userId?: string; limit?: number } = {}) {
  const now = opts.now ?? new Date();
  const settings = await getSettings();
  const candidates = await prisma.vaultItem.findMany({
    where: { status: "PENDING", expiresAt: { lte: now }, ...(opts.userId ? { userId: opts.userId } : {}) },
    select: { id: true },
    take: opts.limit ?? 500,
    orderBy: { expiresAt: "asc" },
  });

  let sold = 0;
  let held = 0;
  for (const { id } of candidates) {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "VaultItem" WHERE "id" = ${id} FOR UPDATE`;
      if (rows.length !== 1) return;
      const item = await tx.vaultItem.findUniqueOrThrow({ where: { id } });
      // Re-check under the lock: the user may have decided in the meantime.
      if (item.status !== "PENDING" || !item.expiresAt || item.expiresAt > now) return;
      if (settings.vaultDefaultAction === "AUTO_SELL") {
        await sellBackInTx(tx, item, settings, true);
        sold++;
      } else {
        await tx.vaultItem.update({
          where: { id },
          data: { status: "HELD", expiresAt: null, decidedAt: new Date(), autoDecided: true },
        });
        held++;
      }
    });
  }
  return { examined: candidates.length, sold, held };
}
