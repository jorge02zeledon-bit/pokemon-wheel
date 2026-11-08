import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getSettings } from "../settings";
import { computeWheelEv } from "../engine/ev";
import { ValidationError } from "../engine/errors";
import { logAdminAction } from "./audit";
import { BPS_SCALE } from "@/lib/money";

/**
 * Admin wheel editing. A wheel and all its tiers are saved as one unit in a
 * transaction. Odds must total exactly 10,000 bps or the save is rejected.
 * Tiers that have been awarded in past spins cannot be deleted (the audit log
 * references them); set their odds to 0 instead, which removes them from play
 * and from public display.
 */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #22d3ee");

export const tierDraftSchema = z.object({
  id: z.string().optional(), // absent for new tiers
  name: z.string().trim().min(1).max(40),
  rarity: z.enum(["COMMON", "UNCOMMON", "RARE", "CHASE"]),
  oddsBps: z.number().int().min(0).max(BPS_SCALE),
  color: hexColor,
  productIds: z.array(z.string()).max(50),
});

export const wheelDraftSchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and dashes").max(64),
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  spinPriceCents: z.number().int().min(1),
  sortOrder: z.number().int().min(0).max(999),
  isActive: z.boolean(),
  guaranteedFloor: z.boolean(),
  accentColor: hexColor,
  tiers: z.array(tierDraftSchema).min(1),
});

export type WheelDraft = z.infer<typeof wheelDraftSchema>;

export async function listWheelsForAdmin() {
  const [wheels, settings] = await Promise.all([
    prisma.wheel.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        tiers: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { products: { include: { product: true } } } },
        _count: { select: { spins: true } },
      },
    }),
    getSettings(),
  ]);
  return wheels.map((w) => ({
    ...w,
    ev: computeWheelEv(
      {
        spinPriceCents: w.spinPriceCents,
        guaranteedFloor: w.guaranteedFloor,
        tiers: w.tiers.map((t) => ({ name: t.name, oddsBps: t.oddsBps, products: t.products.map((tp) => tp.product) })),
      },
      settings,
    ),
  }));
}

export async function getWheelForAdmin(id: string) {
  return prisma.wheel.findUnique({
    where: { id },
    include: {
      tiers: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { products: { include: { product: true } }, _count: { select: { spins: true } } },
      },
    },
  });
}

export async function saveWheel(adminId: string, raw: unknown) {
  const draft = wheelDraftSchema.parse(raw);
  const sum = draft.tiers.reduce((a, t) => a + t.oddsBps, 0);
  if (sum !== BPS_SCALE) throw new ValidationError(`Odds must total exactly 100% (currently ${(sum / 100).toFixed(2)}%)`);
  for (const t of draft.tiers) {
    if (t.oddsBps > 0 && t.productIds.length === 0) throw new ValidationError(`Tier "${t.name}" needs at least one product`);
  }
  const productIds = [...new Set(draft.tiers.flatMap((t) => t.productIds))];
  const found = await prisma.product.count({ where: { id: { in: productIds } } });
  if (found !== productIds.length) throw new ValidationError("A selected product no longer exists");

  return prisma.$transaction(async (tx) => {
    const before = draft.id ? await tx.wheel.findUnique({ where: { id: draft.id }, include: { tiers: { include: { products: true } } } }) : null;
    if (draft.id && !before) throw new ValidationError("Wheel not found");

    const data = {
      slug: draft.slug,
      name: draft.name,
      tagline: draft.tagline || null,
      description: draft.description || null,
      spinPriceCents: draft.spinPriceCents,
      sortOrder: draft.sortOrder,
      isActive: draft.isActive,
      guaranteedFloor: draft.guaranteedFloor,
      accentColor: draft.accentColor,
    };
    let wheelId: string;
    try {
      const wheel = draft.id ? await tx.wheel.update({ where: { id: draft.id }, data }) : await tx.wheel.create({ data });
      wheelId = wheel.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("That slug is already in use");
      throw e;
    }

    // Tiers: update existing by id, create new, delete removed (if unreferenced).
    const keepIds = new Set(draft.tiers.map((t) => t.id).filter((x): x is string => !!x));
    const existing = before?.tiers ?? [];
    for (const t of existing) {
      if (keepIds.has(t.id)) continue;
      const used = await tx.spin.count({ where: { tierId: t.id } });
      if (used > 0) throw new ValidationError(`Tier "${t.name}" has been awarded ${used} time(s) and cannot be deleted. Set its odds to 0% instead.`);
      await tx.tier.delete({ where: { id: t.id } });
    }
    for (const [i, t] of draft.tiers.entries()) {
      const tierData = { name: t.name, rarity: t.rarity, oddsBps: t.oddsBps, color: t.color, sortOrder: i };
      if (t.id) {
        if (!existing.some((e) => e.id === t.id)) throw new ValidationError("Tier does not belong to this wheel");
        await tx.tier.update({ where: { id: t.id }, data: tierData });
        await tx.tierProduct.deleteMany({ where: { tierId: t.id, productId: { notIn: t.productIds } } });
        await tx.tierProduct.createMany({ data: t.productIds.map((productId) => ({ tierId: t.id!, productId })), skipDuplicates: true });
      } else {
        await tx.tier.create({ data: { ...tierData, wheelId, products: { create: t.productIds.map((productId) => ({ productId })) } } });
      }
    }

    const after = await tx.wheel.findUniqueOrThrow({ where: { id: wheelId }, include: { tiers: { include: { products: true } } } });
    await logAdminAction(tx, { adminId, action: draft.id ? "wheel.update" : "wheel.create", entityType: "Wheel", entityId: wheelId, before, after });
    return after;
  });
}
