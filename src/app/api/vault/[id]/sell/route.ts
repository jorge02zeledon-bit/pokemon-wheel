import { NextResponse } from "next/server";
import { requireUserId } from "@/server/guards";
import { sellBack } from "@/server/vault/decisions";
import { apiError } from "@/server/api";

/** POST /api/vault/:id/sell: sell the item back for the configured % of its value. */
export async function POST(_req: Request, ctx: RouteContext<"/api/vault/[id]/sell">) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const r = await sellBack(userId, id);
    return NextResponse.json({ status: r.item.status, buybackCents: r.buybackCents, balanceAfterCents: r.balanceAfterCents });
  } catch (e) {
    return apiError(e);
  }
}
