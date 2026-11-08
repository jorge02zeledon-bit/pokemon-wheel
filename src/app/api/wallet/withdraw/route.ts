import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, requireRealMoney } from "@/server/guards";
import { createWithdrawal } from "@/server/wallet/withdrawals";
import { rateLimitResponse } from "@/server/rate-limit";
import { apiError, readJson } from "@/server/api";

const body = z.object({ amountCents: z.number().int(), destination: z.record(z.string(), z.string().max(200)).default({}) });

/** POST /api/wallet/withdraw { amountCents, destination }: real-money mode only. */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const limited = rateLimitResponse(`withdraw:${userId}`, 5, 3_600_000);
    if (limited) return limited;
    requireRealMoney();
    const { amountCents, destination } = body.parse(await readJson(req));
    const w = await createWithdrawal(userId, amountCents, destination);
    return NextResponse.json({ status: w.status, withdrawalId: w.id });
  } catch (e) {
    return apiError(e);
  }
}
