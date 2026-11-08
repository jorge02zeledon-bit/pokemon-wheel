import type { ExclusionDuration } from "@prisma/client";
import { prisma } from "../db";
import { ValidationError } from "../engine/errors";

/**
 * "Take a break" cooldowns and self-exclusion.
 * Neither can be shortened or removed by the user. Self-exclusion also blocks
 * deposits; the user keeps access to their vault and withdrawals.
 */

export const BREAK_OPTIONS_HOURS = [24, 72, 168] as const; // 1 day, 3 days, 7 days

export async function takeBreak(userId: string, hours: number) {
  if (!(BREAK_OPTIONS_HOURS as readonly number[]).includes(hours)) throw new ValidationError("Choose 24, 72 or 168 hours");
  const until = new Date(Date.now() + hours * 3_600_000);
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { cooldownUntil: true } });
    if (u.cooldownUntil && u.cooldownUntil > until) throw new ValidationError("You already have a longer break in place");
    return tx.user.update({ where: { id: userId }, data: { cooldownUntil: until }, select: { cooldownUntil: true } });
  });
}

const DURATION_MS: Record<ExclusionDuration, number | null> = {
  DAYS_30: 30 * 86_400_000,
  MONTHS_6: 182 * 86_400_000,
  PERMANENT: null,
};
const RANK: Record<ExclusionDuration, number> = { DAYS_30: 1, MONTHS_6: 2, PERMANENT: 3 };

export async function selfExclude(userId: string, duration: ExclusionDuration, confirmation: string) {
  if (confirmation !== "EXCLUDE") throw new ValidationError('Type EXCLUDE to confirm');
  const ms = DURATION_MS[duration];
  if (ms === undefined) throw new ValidationError("Unknown duration");
  const now = new Date();
  const endsAt = ms === null ? null : new Date(now.getTime() + ms);
  return prisma.$transaction(async (tx) => {
    const active = await tx.selfExclusion.findFirst({ where: { userId, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { createdAt: "desc" } });
    // Never shorten or restart: only a strictly longer tier may replace an active exclusion.
    if (active && RANK[active.duration] >= RANK[duration]) {
      throw new ValidationError("An equal or longer self-exclusion is already in place");
    }
    return tx.selfExclusion.create({ data: { userId, duration, startsAt: now, endsAt } });
  });
}

export async function getActiveExclusion(userId: string, now = new Date()) {
  return prisma.selfExclusion.findFirst({ where: { userId, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { createdAt: "desc" } });
}
