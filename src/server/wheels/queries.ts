import { prisma } from "../db";

/**
 * Read models for wheels. Tiers are ordered by sortOrder then id, which is the
 * canonical order used by the spin engine and the verifier.
 */
export const wheelWithTiers = {
  tiers: {
    where: { oddsBps: { gt: 0 } }, // retired (0%) tiers are hidden from the public
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
    include: {
      products: {
        orderBy: { productId: "asc" as const },
        include: { product: true },
      },
    },
  },
};

export async function listActiveWheels() {
  return prisma.wheel.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: wheelWithTiers,
  });
}

export async function getWheelBySlug(slug: string) {
  return prisma.wheel.findUnique({ where: { slug }, include: wheelWithTiers });
}

export type WheelWithTiers = NonNullable<Awaited<ReturnType<typeof getWheelBySlug>>>;

/** Min/max prize value and the top prize product across all tiers of a wheel. */
export function wheelPrizeRange(wheel: WheelWithTiers) {
  const all = wheel.tiers.flatMap((t) => t.products.map((tp) => tp.product));
  if (all.length === 0) return { minCents: 0, maxCents: 0, topProduct: null };
  let min = all[0];
  let max = all[0];
  for (const p of all) {
    if (p.valueCents < min.valueCents) min = p;
    if (p.valueCents > max.valueCents) max = p;
  }
  return { minCents: min.valueCents, maxCents: max.valueCents, topProduct: max };
}

/** True when every product the wheel can award has at least one unit in stock. */
export function wheelFullyStocked(wheel: WheelWithTiers): boolean {
  return wheel.tiers.every((t) => t.products.length > 0 && t.products.every((tp) => tp.product.stock > 0 && tp.product.isActive));
}
