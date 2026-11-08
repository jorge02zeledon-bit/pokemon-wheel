import { prisma } from "../db";
import { applyLedgerEntry } from "../wallet/ledger";
import { ValidationError } from "../engine/errors";
import { logAdminAction } from "./audit";

export async function listUsersForAdmin(query?: string) {
  return prisma.user.findMany({
    where: query ? { OR: [{ email: { contains: query, mode: "insensitive" } }, { displayName: { contains: query, mode: "insensitive" } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, email: true, displayName: true, role: true, stateCode: true, identityStatus: true,
      demoBalanceCents: true, realBalanceCents: true, createdAt: true, cooldownUntil: true,
      _count: { select: { spins: true } },
    },
  });
}

export async function getUserForAdmin(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      playLimit: true,
      selfExclusions: { orderBy: { createdAt: "desc" } },
      verifications: { orderBy: { createdAt: "desc" }, take: 5 },
      ledgerEntries: { orderBy: { createdAt: "desc" }, take: 25 },
      _count: { select: { spins: true, vaultItems: true, orders: true } },
    },
  });
}

export async function setUserRole(adminId: string, userId: string, role: "USER" | "ADMIN") {
  if (adminId === userId && role !== "ADMIN") throw new ValidationError("You cannot remove your own admin role");
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
    const after = await tx.user.update({ where: { id: userId }, data: { role }, select: { role: true } });
    await logAdminAction(tx, { adminId, action: "user.role", entityType: "User", entityId: userId, before, after });
    return after;
  });
}

/** Manual balance adjustment (refunds, goodwill, corrections). Always recorded with a reason. */
export async function adjustBalance(adminId: string, userId: string, amountCents: number, isDemo: boolean, reason: string) {
  if (!Number.isInteger(amountCents) || amountCents === 0) throw new ValidationError("Enter a non-zero amount");
  if (!reason.trim()) throw new ValidationError("Give a reason for the adjustment");
  return prisma.$transaction(async (tx) => {
    const entry = await applyLedgerEntry(tx, {
      userId, type: "ADJUSTMENT", amountCents, isDemo, referenceType: "ADMIN", referenceId: adminId, description: `Admin adjustment: ${reason.trim()}`,
    });
    await logAdminAction(tx, { adminId, action: "user.balance", entityType: "User", entityId: userId, after: { amountCents, isDemo, reason: reason.trim(), ledgerEntryId: entry.id } });
    return entry;
  });
}
