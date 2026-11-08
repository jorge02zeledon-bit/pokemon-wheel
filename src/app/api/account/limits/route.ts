import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/server/guards";
import { prisma } from "@/server/db";
import { getEffectiveLimits, setLimits } from "@/server/compliance/limits";
import { apiError, readJson } from "@/server/api";

const cents = z.number().int().nullable();
const body = z.object({ dailyDepositCents: cents.optional(), weeklyDepositCents: cents.optional(), monthlyDepositCents: cents.optional(), dailySpendCents: cents.optional() });

export async function GET() {
  try {
    return NextResponse.json(await getEffectiveLimits(prisma, await requireUserId()));
  } catch (e) {
    return apiError(e);
  }
}

/** POST /api/account/limits: set or clear limits. Stricter applies now; looser after cooling-off. */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const input = body.parse(await readJson(req));
    return NextResponse.json(await setLimits(userId, input));
  } catch (e) {
    return apiError(e);
  }
}
