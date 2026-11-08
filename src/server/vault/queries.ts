import { prisma } from "../db";

export async function listVaultItems(userId: string) {
  return prisma.vaultItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true, imageUrl: true, category: true } },
      spin: { select: { id: true, wheelId: true, tier: { select: { name: true, rarity: true } }, wheel: { select: { name: true, slug: true } } } },
      order: { select: { id: true, status: true, carrier: true, trackingNumber: true, createdAt: true } },
    },
  });
}

export type VaultItemView = Awaited<ReturnType<typeof listVaultItems>>[number];
