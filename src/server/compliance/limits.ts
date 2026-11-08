import { Prisma, type PlayLimit } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { getSettings } from "../settings";
import { NotEligibleError, ValidationError } from "../engine/errors";
import { formatCents } from "@/lib/money";

/**
 * Responsible play limits.
 *
 * Users set deposit limits (daily / weekly / monthly) and a daily spend limit.
 * Making a limit stricter applies immediately. Loosening or removing one is
 * queued and applies only after `limitIncreaseCoolingHours` (default 24h), so
 * a limit cannot be lifted in the heat of the moment. Windows are rolling
 * (24h / 7d / 30d).
 */

export const LIMIT_FIELDS = ["dailyDepositCents", "weeklyDepositCents", "monthlyDepositCents", "dailySpendCents"] as const;
export type LimitField = (typeof LIMIT_FIELDS)[number];
export type LimitValues = Record<LimitField, number | null>;

const EMPTY: LimitValues = { dailyDepositCents: null, weeklyDepositCents: null, monthlyDepositCents: null, dailySpendCents: null };
const DAY = 86_400_000;

function pendingOf(row: PlayLimit | null): Partial<LimitValues> {
  return (row?.pendingChanges as Partial<LimitValues> | null) ?? {};
}

/** Current limits, applying any pending loosening whose cooling-off has passed. */
export async function getEffectiveLimits(db: Tx | typeof prisma, userId: string, now = new Date()) {
  let row = await db.playLimit.findUnique({ where: { userId } });
  if (row?.pendingEffectiveAt && row.pendingEffectiveAt <= now) {
    row = await db.playLimit.update({ where: { userId }, data: { ...pendingOf(row), pendingChanges: Prisma.JsonNull, pendingEffectiveAt: null } });
  }
  const limits: LimitValues = { ...EMPTY };
  for (const f of LIMIT_FIELDS) limits[f] = row?.[f] ?? null;
  return { limits, pending: row?.pendingEffectiveAt && row.pendingEffectiveAt > now ? pendingOf(row) : {}, pendingEffectiveAt: row?.pendingEffectiveAt && row.pendingEffectiveAt > now ? row.pendingEffectiveAt : null };
}

/**
 * Change limits. `null` removes a limit. Stricter changes apply now; looser
 * ones (higher value or removal) are scheduled after the cooling-off period.
 */
export async function setLimits(userId: string, input: Partial<LimitValues>) {
  for (const [k, v] of Object.entries(input)) {
    if (!(LIMIT_FIELDS as readonly string[]).includes(k)) throw new ValidationError(`Unknown limit ${k}`);
    if (v !== null && (!Number.isInteger(v) || v < 100)) throw new ValidationError("Limits must be at least $1.00");
  }
  const settings = await getSettings();
  return prisma.$transaction(async (tx) => {
    const { limits: current, pending: existingPending } = await getEffectiveLimits(tx, userId);
    const immediate: Partial<LimitValues> = {};
    const pending: Partial<LimitValues> = { ...existingPending };
    for (const [k, v] of Object.entries(input) as [LimitField, number | null][]) {
      const cur = current[k];
      const stricter = v !== null && (cur === null || v < cur);
      const same = v === cur;
      if (same) { delete pending[k]; continue; }
      if (stricter) { immediate[k] = v; delete pending[k]; }
      else pending[k] = v; // loosening or removing
    }
    const hasPending = Object.keys(pending).length > 0;
    const pendingEffectiveAt = hasPending ? new Date(Date.now() + settings.limitIncreaseCoolingHours * 3_600_000) : null;
    await tx.playLimit.upsert({
      where: { userId },
      create: { userId, ...immediate, pendingChanges: hasPending ? (pending as Prisma.InputJsonObject) : undefined, pendingEffectiveAt },
      update: { ...immediate, pendingChanges: hasPending ? (pending as Prisma.InputJsonObject) : Prisma.JsonNull, pendingEffectiveAt },
    });
    return getEffectiveLimits(tx, userId);
  });
}

/** Sum of successful + pending real deposits since `since`. */
async function depositedSince(db: Tx | typeof prisma, userId: string, since: Date): Promise<number> {
  const r = await db.deposit.aggregate({ where: { userId, status: { in: ["SUCCEEDED", "PENDING"] }, createdAt: { gte: since } }, _sum: { amountCents: true } });
  return r._sum.amountCents ?? 0;
}

export async function assertDepositWithinLimits(db: Tx | typeof prisma, userId: string, amountCents: number, now = new Date()) {
  const { limits } = await getEffectiveLimits(db, userId, now);
  const windows: [LimitField, number, string][] = [
    ["dailyDepositCents", DAY, "daily"],
    ["weeklyDepositCents", 7 * DAY, "weekly"],
    ["monthlyDepositCents", 30 * DAY, "monthly"],
  ];
  for (const [field, ms, label] of windows) {
    const limit = limits[field];
    if (limit === null) continue;
    const used = await depositedSince(db, userId, new Date(now.getTime() - ms));
    if (used + amountCents > limit) {
      throw new NotEligibleError("DEPOSIT_LIMIT", `This deposit would exceed your ${label} deposit limit of ${formatCents(limit)} (${formatCents(used)} used)`);
    }
  }
}

/** Amount spent on spins (positive cents) in the last 24h for the given mode. */
export async function spentSince(db: Tx | typeof prisma, userId: string, isDemo: boolean, since: Date): Promise<number> {
  const r = await db.ledgerEntry.aggregate({ where: { userId, type: "SPIN", isDemo, createdAt: { gte: since } }, _sum: { amountCents: true } });
  return -(r._sum.amountCents ?? 0);
}

export async function assertSpendWithinLimits(db: Tx | typeof prisma, userId: string, priceCents: number, isDemo: boolean, now = new Date()) {
  const { limits } = await getEffectiveLimits(db, userId, now);
  if (limits.dailySpendCents === null) return;
  const used = await spentSince(db, userId, isDemo, new Date(now.getTime() - DAY));
  if (used + priceCents > limits.dailySpendCents) {
    throw new NotEligibleError("SPEND_LIMIT", `This spin would exceed your daily spend limit of ${formatCents(limits.dailySpendCents)} (${formatCents(used)} spent in the last 24h)`);
  }
}
