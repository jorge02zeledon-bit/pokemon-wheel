import type { VerificationStatus } from "@prisma/client";
import { prisma } from "../db";
import { getIdentityProvider, type VerificationUpdate } from "../providers/identity";
import { ValidationError } from "../engine/errors";
import { logAdminAction } from "../admin/audit";

/**
 * Identity verification orchestration on top of the IdentityProvider.
 * A user's `identityStatus` is the latest outcome; IdentityVerification rows
 * are the history.
 */

export async function startVerification(userId: string, returnUrl: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.ageConfirmedAt) throw new ValidationError("Confirm you are 18 or older first");
  if (user.identityStatus === "APPROVED") throw new ValidationError("Your identity is already verified");
  const pending = await prisma.identityVerification.findFirst({ where: { userId, status: "PENDING" } });
  if (pending) return { verification: pending, redirectUrl: undefined };

  const provider = getIdentityProvider();
  const started = await provider.start({ userId, email: user.email, returnUrl });
  const verification = await prisma.$transaction(async (tx) => {
    const v = await tx.identityVerification.create({ data: { userId, provider: provider.name, providerRef: started.providerRef, status: started.status } });
    await tx.user.update({ where: { id: userId }, data: { identityStatus: started.status } });
    return v;
  });
  return { verification, redirectUrl: started.redirectUrl };
}

/** Apply a status change from a webhook or a poll. Idempotent. */
export async function applyVerificationUpdate(update: VerificationUpdate) {
  return prisma.$transaction(async (tx) => {
    const v = await tx.identityVerification.findFirst({ where: { providerRef: update.providerRef } });
    if (!v) return null;
    if (v.status === update.status) return v;
    const updated = await tx.identityVerification.update({ where: { id: v.id }, data: { status: update.status, reason: update.reason, metadata: update.raw as object | undefined } });
    await tx.user.update({ where: { id: v.userId }, data: { identityStatus: update.status } });
    return updated;
  });
}

/** Poll the provider for the user's pending verification, if any. */
export async function refreshVerification(userId: string) {
  const pending = await prisma.identityVerification.findFirst({ where: { userId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (pending?.providerRef) {
    const update = await getIdentityProvider().poll(pending.providerRef, pending.createdAt);
    if (update) await applyVerificationUpdate(update);
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { identityStatus: true } });
  const latest = await prisma.identityVerification.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  return { status: user.identityStatus as VerificationStatus, latest };
}

/** Manual override from the admin panel (e.g. after reviewing documents offline). */
export async function adminSetIdentityStatus(adminId: string, userId: string, status: "APPROVED" | "REJECTED", reason: string) {
  if (!reason.trim()) throw new ValidationError("Give a reason");
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { identityStatus: true } });
    await tx.identityVerification.updateMany({ where: { userId, status: "PENDING" }, data: { status, reason: `Admin: ${reason.trim()}` } });
    await tx.identityVerification.create({ data: { userId, provider: "admin", providerRef: `admin_${adminId}_${Date.now()}`, status, reason: reason.trim() } });
    await tx.user.update({ where: { id: userId }, data: { identityStatus: status } });
    await logAdminAction(tx, { adminId, action: "user.identity", entityType: "User", entityId: userId, before, after: { identityStatus: status, reason: reason.trim() } });
  });
}
