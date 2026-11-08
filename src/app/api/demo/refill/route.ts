import { NextResponse } from "next/server";
import { requireUserId } from "@/server/guards";
import { getDemoRefillStatus, refillDemoCredits } from "@/server/wallet/demo";
import { apiError } from "@/server/api";

/** GET /api/demo/refill: whether a demo refill is available for the user. */
export async function GET() {
  try {
    return NextResponse.json(await getDemoRefillStatus(await requireUserId()));
  } catch (e) {
    return apiError(e);
  }
}

/** POST /api/demo/refill: grant demo credits (demo mode only, cooldown enforced). */
export async function POST() {
  try {
    return NextResponse.json(await refillDemoCredits(await requireUserId()));
  } catch (e) {
    return apiError(e);
  }
}
