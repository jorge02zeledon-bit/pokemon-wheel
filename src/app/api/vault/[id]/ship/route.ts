import { NextResponse } from "next/server";
import { requireUserId, requireRealMoney } from "@/server/guards";
import { requestShipping } from "@/server/vault/decisions";
import { shippingAddressSchema } from "@/lib/validation/address";
import { apiError, readJson } from "@/server/api";

/** POST /api/vault/:id/ship { address }: request shipping (real-money mode only). */
export async function POST(req: Request, ctx: RouteContext<"/api/vault/[id]/ship">) {
  try {
    const userId = await requireUserId();
    requireRealMoney(); // gate first: in demo mode the answer is always DEMO_MODE
    const { id } = await ctx.params;
    const address = shippingAddressSchema.parse(await readJson(req));
    const r = await requestShipping(userId, id, address);
    return NextResponse.json({ status: r.item.status, orderId: r.order.id, feeCents: r.feeCents, balanceAfterCents: r.balanceAfterCents });
  } catch (e) {
    return apiError(e);
  }
}
