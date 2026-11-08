import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../db";
import { ValidationError } from "../engine/errors";
import { logAdminAction } from "./audit";
import { sendMailSafe } from "../providers/mail";

export const orderUpdateSchema = z.object({
  status: z.enum(OrderStatus),
  carrier: z.string().trim().max(40).optional().or(z.literal("")),
  trackingNumber: z.string().trim().max(80).optional().or(z.literal("")),
  adminNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function listOrdersForAdmin(status?: OrderStatus) {
  return prisma.order.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { email: true, displayName: true } }, vaultItem: { include: { product: { select: { name: true } } } } },
  });
}

export async function getOrderForAdmin(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, displayName: true, identityStatus: true } },
      vaultItem: { include: { product: true, spin: { select: { id: true, createdAt: true, wheel: { select: { name: true } } } } } },
    },
  });
}

/** Update fulfilment fields. Moving to SHIPPED also marks the vault item SHIPPED. */
export async function updateOrder(adminId: string, orderId: string, raw: unknown) {
  const d = orderUpdateSchema.parse(raw);
  if (d.status === "SHIPPED" && !d.trackingNumber) throw new ValidationError("Add a tracking number before marking as shipped");
  return prisma.$transaction(async (tx) => {
    const before = await tx.order.findUnique({ where: { id: orderId }, include: { vaultItem: true } });
    if (!before) throw new ValidationError("Order not found");
    const after = await tx.order.update({
      where: { id: orderId },
      data: { status: d.status, carrier: d.carrier || null, trackingNumber: d.trackingNumber || null, adminNotes: d.adminNotes || null },
    });
    if (before.vaultItem) {
      const vaultStatus = d.status === "SHIPPED" || d.status === "DELIVERED" ? "SHIPPED" : "SHIP_REQUESTED";
      await tx.vaultItem.update({ where: { id: before.vaultItem.id }, data: { status: vaultStatus } });
    }
    await logAdminAction(tx, { adminId, action: "order.update", entityType: "Order", entityId: orderId, before: { ...before, vaultItem: undefined }, after });
    if (d.status === "SHIPPED" && before.status !== "SHIPPED") {
      const user = await tx.user.findUnique({ where: { id: before.userId }, select: { email: true } });
      if (user) sendMailSafe({ to: user.email, subject: "Your HonshuWheel prize has shipped", text: `Your order has shipped${d.carrier ? ` via ${d.carrier}` : ""}. Tracking: ${d.trackingNumber}.` });
    }
    return after;
  });
}
