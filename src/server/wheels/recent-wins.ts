import { prisma } from "../db";
import { getSettings } from "../settings";

/** Mask a display name for public feeds: "Smoke Tester" -> "Smo***". */
export function maskName(name: string | null): string {
  const n = (name ?? "Player").trim();
  if (n.length <= 3) return `${n}***`;
  return `${n.slice(0, 3)}***`;
}

export interface RecentWin {
  id: string;
  player: string;
  tierName: string;
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "CHASE";
  tierColor: string;
  productName: string;
  valueCents: number;
  wheelSlug: string;
  wheelName: string;
  isDemo: boolean;
  createdAt: string;
}

export async function listRecentWins(opts: { wheelSlug?: string; limit?: number } = {}): Promise<RecentWin[]> {
  const settings = await getSettings();
  const spins = await prisma.spin.findMany({
    where: opts.wheelSlug ? { wheel: { slug: opts.wheelSlug } } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.limit ?? settings.recentWinsLimit, 100),
    include: {
      user: { select: { displayName: true } },
      tier: { select: { name: true, rarity: true, color: true } },
      product: { select: { name: true } },
      wheel: { select: { slug: true, name: true } },
    },
  });
  return spins.map((s) => ({
    id: s.id,
    player: maskName(s.user.displayName),
    tierName: s.tier.name,
    rarity: s.tier.rarity,
    tierColor: s.tier.color,
    productName: s.product.name,
    valueCents: s.productValueCents,
    wheelSlug: s.wheel.slug,
    wheelName: s.wheel.name,
    isDemo: s.isDemo,
    createdAt: s.createdAt.toISOString(),
  }));
}
