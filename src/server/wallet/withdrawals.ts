import { prisma } from "../db";
import { requireRealMoney } from "../errors";
import { NotEligibleError, ValidationError } from "../engine/errors";
import { applyLedgerEntry } from "./ledger";
import { getPaymentProvider, type PaymentOutcome } from "../providers/payment";
import { logAdminAction } from "../admin/audit";

export const MIN_WITHDRAWAL_CENTS = 2000; // $20

/**
 * Withdrawals (real money only). The amount is debited immediately as a hold
 * so it cannot be spent while the payout is processing; a failed payout
 * refunds it. Demo credits can never be withdrawn (separate balance).
 */
export async function createWithdrawal(userId: string, amountCents: number, destination: Record<string, string>) {
  requireRealMoney();
  if (!Number.isInteger(amountCents) || amountCents < MIN_WITHDRAWAL_CENTS) throw new ValidationError(`Minimum withdrawal is $${MIN_WITHDRAWAL_CENTS / 100}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.identityStatus !== "APPROVED") throw new NotEligibleError("IDENTITY_REQUIRED", "Verify your identity before withdrawing");

  const withdrawal = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const w = await tx.withdrawal.create({ data: { userId, provider: getPaymentProvider().name, amountCents, status: "PENDING", metadata: destination } });
    await applyLedgerEntry(tx, { userId, type: "WITHDRAWAL", amountCents: -amountCents, isDemo: false, referenceType: "WITHDRAWAL", referenceId: w.id, description: "Withdrawal (processing)" });
    return w;
  });
  const result = await getPaymentProvider().createWithdrawal({ withdrawalId: withdrawal.id, userId, amountCents, destination });
  await prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { providerRef: result.providerRef } });
  return finalizeWithdrawal(withdrawal.id, result.status);
}

/** Idempotent. FAILED/CANCELLED refunds the hold. */
export async function finalizeWithdrawal(withdrawalId: string, status: PaymentOutcome | "CANCELLED", adminId?: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Withdrawal" WHERE "id" = ${withdrawalId} FOR UPDATE`;
    if (rows.length !== 1) throw new ValidationError("Withdrawal not found");
    const w = await tx.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
    if (w.status !== "PENDING" || status === "PENDING") return w;
    if (status === "FAILED" || status === "CANCELLED") {
      await applyLedgerEntry(tx, { userId: w.userId, type: "REFUND", amountCents: w.amountCents, isDemo: false, referenceType: "WITHDRAWAL", referenceId: w.id, description: `Withdrawal ${status.toLowerCase()}: funds returned` });
    }
    const updated = await tx.withdrawal.update({ where: { id: withdrawalId }, data: { status, metadata: { ...(w.metadata as object), note } } });
    if (adminId) await logAdminAction(tx, { adminId, action: "withdrawal.finalize", entityType: "Withdrawal", entityId: w.id, before: { status: w.status }, after: { status, note } });
    return updated;
  });
}
