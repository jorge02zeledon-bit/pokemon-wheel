import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, requireRealMoney } from "@/server/guards";
import { createDeposit } from "@/server/wallet/deposits";
import { apiError, readJson } from "@/server/api";

const body = z.object({ amountCents: z.number().int() });

/** POST /api/wallet/deposit { amountCents }: real-money mode only. */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    requireRealMoney();
    const { amountCents } = body.parse(await readJson(req));
    const r = await createDeposit(userId, amountCents, new URL("/wallet", req.url).toString());
    return NextResponse.json({ status: r.deposit.status, depositId: r.deposit.id, redirectUrl: r.redirectUrl ?? null });
  } catch (e) {
    return apiError(e);
  }
}
