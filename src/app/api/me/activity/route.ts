import { NextResponse } from "next/server";
import { requireUserId } from "@/server/guards";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/config";
import { spentSince, getEffectiveLimits } from "@/server/compliance/limits";
import { apiError } from "@/server/api";

/**
 * GET /api/me/activity?since=<ISO>: spend tracker. Returns the amount spent on
 * spins in the last 24h, since `since` (the client's session start), and the
 * user's daily spend limit, for the current mode (demo or real).
 */
export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const isDemo = isDemoMode();
    const sinceParam = new URL(req.url).searchParams.get("since");
    const since = sinceParam && !Number.isNaN(Date.parse(sinceParam)) ? new Date(sinceParam) : new Date(Date.now() - 86_400_000);
    const [day, session, limits, spinsToday] = await Promise.all([
      spentSince(prisma, userId, isDemo, new Date(Date.now() - 86_400_000)),
      spentSince(prisma, userId, isDemo, since),
      getEffectiveLimits(prisma, userId),
      prisma.spin.count({ where: { userId, isDemo, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    ]);
    return NextResponse.json({ isDemo, spentLast24hCents: day, spentSessionCents: session, spinsLast24h: spinsToday, dailySpendLimitCents: limits.limits.dailySpendCents });
  } catch (e) {
    return apiError(e);
  }
}
