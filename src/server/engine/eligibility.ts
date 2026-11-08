import type { User } from "@prisma/client";
import type { Tx } from "../db";
import { NotEligibleError } from "./errors";
import { stateName } from "@/lib/us-states";

/**
 * Compliance checks that must pass before a spin is allowed.
 * Called inside the spin transaction with the user's row already locked.
 *
 * Phase 2 covers: age confirmation, stated state, IP-derived state, active
 * self-exclusion and "take a break" cooldown. Phase 6 adds spend limits and
 * wires the IP state from the GeoProvider.
 */
export interface EligibilityContext {
  /** Two-letter US state derived from the request IP, when known. */
  ipState?: string | null;
}

export async function assertSpinEligible(tx: Tx, user: User, ctx: EligibilityContext = {}): Promise<void> {
  const now = new Date();

  if (!user.ageConfirmedAt) {
    throw new NotEligibleError("AGE_NOT_CONFIRMED", "You must confirm you are 18 or older before spinning");
  }
  if (!user.stateCode) {
    throw new NotEligibleError("NO_STATE", "Add your state of residence to your account before spinning");
  }

  const codes = [user.stateCode, ctx.ipState].filter((c): c is string => !!c);
  const blocked = await tx.blockedState.findMany({ where: { code: { in: codes } } });
  const blockedStated = blocked.find((b) => b.code === user.stateCode);
  if (blockedStated) {
    throw new NotEligibleError("BLOCKED_STATE", `Spinning is not available to residents of ${stateName(blockedStated.code)}`);
  }
  const blockedIp = blocked.find((b) => b.code === ctx.ipState);
  if (blockedIp) {
    throw new NotEligibleError("BLOCKED_IP_STATE", `Spinning is not available from your current location (${stateName(blockedIp.code)})`);
  }

  const exclusion = await tx.selfExclusion.findFirst({
    where: { userId: user.id, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    orderBy: { createdAt: "desc" },
  });
  if (exclusion) {
    throw new NotEligibleError(
      "SELF_EXCLUDED",
      exclusion.endsAt
        ? `Your account is self-excluded until ${exclusion.endsAt.toLocaleDateString("en-US")}`
        : "Your account is permanently self-excluded",
      exclusion.endsAt ?? undefined,
    );
  }

  if (user.cooldownUntil && user.cooldownUntil > now) {
    throw new NotEligibleError(
      "COOLDOWN",
      `You are taking a break until ${user.cooldownUntil.toLocaleString("en-US")}`,
      user.cooldownUntil,
    );
  }
}

/**
 * Non-throwing preview used by pages to explain up front why the spin button
 * is disabled. The spin itself always re-runs `assertSpinEligible` inside the
 * transaction; this is only for messaging.
 */
export async function previewSpinEligibility(
  db: Tx,
  user: User,
  ctx: EligibilityContext = {},
): Promise<{ ok: true } | { ok: false; reason: NotEligibleError["reason"]; message: string; until: Date | null }> {
  try {
    await assertSpinEligible(db, user, ctx);
    return { ok: true };
  } catch (e) {
    if (e instanceof NotEligibleError) return { ok: false, reason: e.reason, message: e.message, until: e.until ?? null };
    throw e;
  }
}
