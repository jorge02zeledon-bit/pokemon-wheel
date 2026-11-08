import { prisma } from "../db";
import { isDemoMode } from "../config";
import { getSettings } from "../settings";
import { applyLedgerEntry } from "./ledger";
import { ValidationError } from "../engine/errors";

/**
 * Demo credits. Only meaningful while REAL_MONEY_ENABLED=false.
 * A refill is available when the user's demo balance is below the refill
 * amount and the cooldown since their last grant has elapsed.
 */

export class RefillNotAvailableError extends Error {
  constructor(message: string, public readonly availableAt: Date | null) {
    super(message);
    this.name = "RefillNotAvailableError";
  }
}

export async function getDemoRefillStatus(userId: string) {
  const settings = await getSettings();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { demoBalanceCents: true, lastDemoRefillAt: true },
  });
  const cooldownMs = settings.demoRefillCooldownHours * 3_600_000;
  const availableAt = user.lastDemoRefillAt ? new Date(user.lastDemoRefillAt.getTime() + cooldownMs) : null;
  const cooldownOver = !availableAt || availableAt <= new Date();
  const belowThreshold = user.demoBalanceCents < settings.demoRefillCents;
  return {
    enabled: isDemoMode(),
    refillCents: settings.demoRefillCents,
    balanceCents: user.demoBalanceCents,
    available: isDemoMode() && cooldownOver && belowThreshold,
    reason: !isDemoMode() ? "DISABLED" : !belowThreshold ? "BALANCE_TOO_HIGH" : !cooldownOver ? "COOLDOWN" : null,
    availableAt: cooldownOver ? null : availableAt,
  } as const;
}

export async function refillDemoCredits(userId: string) {
  if (!isDemoMode()) throw new ValidationError("Demo credits are not available");
  const settings = await getSettings();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const cooldownMs = settings.demoRefillCooldownHours * 3_600_000;
    const availableAt = user.lastDemoRefillAt ? new Date(user.lastDemoRefillAt.getTime() + cooldownMs) : null;
    if (availableAt && availableAt > new Date()) {
      throw new RefillNotAvailableError(`Next refill available ${availableAt.toLocaleString("en-US")}`, availableAt);
    }
    if (user.demoBalanceCents >= settings.demoRefillCents) {
      throw new RefillNotAvailableError("Refills are available once your demo balance runs low", null);
    }
    const entry = await applyLedgerEntry(tx, {
      userId,
      type: "DEMO_GRANT",
      amountCents: settings.demoRefillCents,
      isDemo: true,
      description: "Demo credit refill",
    });
    await tx.user.update({ where: { id: userId }, data: { lastDemoRefillAt: new Date() } });
    return { balanceCents: entry.balanceAfterCents, grantedCents: settings.demoRefillCents };
  });
}
