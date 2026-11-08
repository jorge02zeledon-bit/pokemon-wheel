import { prisma } from "../db";
import { requireRealMoney } from "../errors";
import { ValidationError } from "../engine/errors";
import { applyLedgerEntry } from "./ledger";
import { getPaymentProvider, type PaymentOutcome } from "../providers/payment";
import { assertDepositWithinLimits } from "../compliance/limits";
import { getActiveExclusion } from "../compliance/exclusion";
import { NotEligibleError } from "../engine/errors";

export const MIN_DEPOSIT_CENTS = 1000; // $10
export const MAX_DEPOSIT_CENTS = 500_000; // $5,000 per transaction

/**
 * Deposits (real money only). Order of checks is deliberate: the real-money
 * gate first, then age + identity (KYC), then self-exclusion, then limits.
 */
export async function createDeposit(userId: string, amountCents: number, returnUrl: string) {
  requireRealMoney();
  if (!Number.isInteger(amountCents) || amountCents < MIN_DEPOSIT_CENTS || amountCents > MAX_DEPOSIT_CENTS) {
    throw new ValidationError(`Deposits must be between $${MIN_DEPOSIT_CENTS / 100} and $${MAX_DEPOSIT_CENTS / 100}`);
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.ageConfirmedAt) throw new NotEligibleError("AGE_NOT_CONFIRMED", "Confirm you are 18 or older before depositing");
  if (user.identityStatus !== "APPROVED") throw new NotEligibleError("IDENTITY_REQUIRED", "Verify your identity before making a deposit");
  if (await getActiveExclusion(userId)) throw new NotEligibleError("SELF_EXCLUDED", "Deposits are not available while you are self-excluded");

  // Reserve the deposit row first so concurrent attempts count against limits.
  const deposit = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    await assertDepositWithinLimits(tx, userId, amountCents);
    return tx.deposit.create({ data: { userId, provider: getPaymentProvider().name, amountCents, status: "PENDING" } });
  });

  const result = await getPaymentProvider().createDeposit({ depositId: deposit.id, userId, amountCents, returnUrl });
  await prisma.deposit.update({ where: { id: deposit.id }, data: { providerRef: result.providerRef } });
  const settled = await settleDeposit(deposit.id, result.status);
  return { deposit: settled, redirectUrl: result.redirectUrl };
}

/** Idempotently move a deposit to its final state, crediting on success. */
export async function settleDeposit(depositId: string, status: PaymentOutcome) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Deposit" WHERE "id" = ${depositId} FOR UPDATE`;
    if (rows.length !== 1) throw new ValidationError("Deposit not found");
    const dep = await tx.deposit.findUniqueOrThrow({ where: { id: depositId } });
    if (dep.status !== "PENDING" || status === "PENDING") return dep;
    if (status === "SUCCEEDED") {
      await applyLedgerEntry(tx, { userId: dep.userId, type: "DEPOSIT", amountCents: dep.amountCents, isDemo: false, referenceType: "DEPOSIT", referenceId: dep.id, description: `Deposit via ${dep.provider}` });
    }
    return tx.deposit.update({ where: { id: depositId }, data: { status } });
  });
}
