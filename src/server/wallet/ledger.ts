import type { LedgerType } from "@prisma/client";
import type { Tx } from "../db";

/**
 * Wallet ledger.
 *
 * Every balance change goes through `applyLedgerEntry`, which must be called
 * inside a transaction. It updates the user's demo or real balance with a
 * conditional UPDATE (so a balance can never go negative under concurrency)
 * and writes an append-only LedgerEntry recording the resulting balance.
 */

export class InsufficientFundsError extends Error {
  constructor(public readonly isDemo: boolean) {
    super(isDemo ? "Insufficient demo credits" : "Insufficient balance");
    this.name = "InsufficientFundsError";
  }
}

export interface LedgerInput {
  userId: string;
  type: LedgerType;
  /** Signed cents. Negative debits the balance. */
  amountCents: number;
  isDemo: boolean;
  referenceType?: string;
  referenceId?: string;
  description?: string;
}

export async function applyLedgerEntry(tx: Tx, input: LedgerInput) {
  if (!Number.isInteger(input.amountCents)) {
    throw new TypeError("amountCents must be an integer number of cents");
  }
  const field = input.isDemo ? "demoBalanceCents" : "realBalanceCents";

  // Conditional update: for debits, require the current balance to cover it.
  // `updateMany` lets us express the WHERE clause; count 0 means it failed.
  const result = await tx.user.updateMany({
    where: {
      id: input.userId,
      ...(input.amountCents < 0 ? { [field]: { gte: -input.amountCents } } : {}),
    },
    data: { [field]: { increment: input.amountCents } },
  });
  if (result.count !== 1) {
    const exists = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true } });
    if (!exists) throw new Error(`User ${input.userId} not found`);
    throw new InsufficientFundsError(input.isDemo);
  }

  const user = await tx.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { demoBalanceCents: true, realBalanceCents: true },
  });
  const balanceAfterCents = input.isDemo ? user.demoBalanceCents : user.realBalanceCents;

  return tx.ledgerEntry.create({
    data: {
      userId: input.userId,
      type: input.type,
      amountCents: input.amountCents,
      balanceAfterCents,
      isDemo: input.isDemo,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      description: input.description,
    },
  });
}
