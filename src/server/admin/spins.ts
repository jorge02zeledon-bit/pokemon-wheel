import type { Prisma, Rarity } from "@prisma/client";
import { prisma } from "../db";

export interface SpinFilter {
  wheelId?: string;
  email?: string;
  rarity?: Rarity;
  page?: number;
  pageSize?: number;
}

/** Paginated, filterable view of the immutable spin log. */
export async function listSpinsForAdmin(f: SpinFilter = {}) {
  const pageSize = Math.min(f.pageSize ?? 50, 200);
  const page = Math.max(1, f.page ?? 1);
  const where: Prisma.SpinWhereInput = {
    ...(f.wheelId ? { wheelId: f.wheelId } : {}),
    ...(f.rarity ? { tier: { rarity: f.rarity } } : {}),
    ...(f.email ? { user: { email: { contains: f.email, mode: "insensitive" } } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.spin.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        wheel: { select: { name: true, slug: true } },
        tier: { select: { name: true, rarity: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.spin.count({ where }),
  ]);
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** CSV export of the current filter (capped). */
export async function exportSpinsCsv(f: SpinFilter = {}): Promise<string> {
  const { rows } = await listSpinsForAdmin({ ...f, page: 1, pageSize: 200 });
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["id", "createdAt", "userEmail", "wheel", "tier", "rarity", "product", "spinPriceCents", "productValueCents", "isDemo", "serverSeed", "serverSeedHash", "clientSeed", "nonce", "resultHash", "tierRoll", "productRoll", "ipState"];
  const lines = rows.map((s) =>
    [s.id, s.createdAt.toISOString(), s.user.email, s.wheel.name, s.tier.name, s.tier.rarity, s.product.name, s.spinPriceCents, s.productValueCents, s.isDemo, s.serverSeed, s.serverSeedHash, s.clientSeed, s.nonce, s.resultHash, s.tierRoll, s.productRoll, s.ipState].map(esc).join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
