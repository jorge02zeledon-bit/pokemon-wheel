import { z } from "zod";
import { Prisma, ProductCategory } from "@prisma/client";
import { prisma } from "../db";
import { ValidationError } from "../engine/errors";
import { logAdminAction } from "./audit";

export const productDraftSchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and dashes").max(80),
  name: z.string().trim().min(2).max(120),
  category: z.enum(ProductCategory),
  valueCents: z.number().int().min(1),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  isActive: z.boolean(),
  /** Only used on create; existing stock is changed through adjustStock. */
  initialStock: z.number().int().min(0).optional(),
});

export type ProductDraft = z.infer<typeof productDraftSchema>;

export async function listProductsForAdmin() {
  return prisma.product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { tiers: { include: { tier: { include: { wheel: { select: { name: true, slug: true } } } } } } },
  });
}

export async function getProductForAdmin(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: { tiers: { include: { tier: { include: { wheel: { select: { id: true, name: true } } } } } }, _count: { select: { spins: true } } },
  });
}

export async function saveProduct(adminId: string, raw: unknown) {
  const d = productDraftSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const before = d.id ? await tx.product.findUnique({ where: { id: d.id } }) : null;
    if (d.id && !before) throw new ValidationError("Product not found");
    const data = { slug: d.slug, name: d.name, category: d.category, valueCents: d.valueCents, description: d.description || null, isActive: d.isActive };
    try {
      const after = d.id
        ? await tx.product.update({ where: { id: d.id }, data })
        : await tx.product.create({ data: { ...data, stock: d.initialStock ?? 0 } });
      await logAdminAction(tx, { adminId, action: d.id ? "product.update" : "product.create", entityType: "Product", entityId: after.id, before, after });
      return after;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError("That slug is already in use");
      throw e;
    }
  });
}

/** Add or remove units with a reason. Never lets stock go negative. */
export async function adjustStock(adminId: string, productId: string, delta: number, reason: string) {
  if (!Number.isInteger(delta) || delta === 0) throw new ValidationError("Enter a non-zero whole number");
  if (!reason.trim()) throw new ValidationError("Give a reason for the stock change");
  return prisma.$transaction(async (tx) => {
    const res = await tx.product.updateMany({
      where: { id: productId, ...(delta < 0 ? { stock: { gte: -delta } } : {}) },
      data: { stock: { increment: delta } },
    });
    if (res.count !== 1) throw new ValidationError("Stock cannot go below zero");
    const after = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    await logAdminAction(tx, {
      adminId, action: "product.stock", entityType: "Product", entityId: productId,
      before: { stock: after.stock - delta }, after: { stock: after.stock, delta, reason: reason.trim() },
    });
    return after;
  });
}

export async function setProductImage(adminId: string, productId: string, imageUrl: string | null) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { imageUrl: true } });
    const after = await tx.product.update({ where: { id: productId }, data: { imageUrl } });
    await logAdminAction(tx, { adminId, action: "product.image", entityType: "Product", entityId: productId, before, after: { imageUrl } });
    return after;
  });
}
