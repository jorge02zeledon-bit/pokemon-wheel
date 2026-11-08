import { NextResponse } from "next/server";
import { requireUserId } from "@/server/guards";
import { startVerification } from "@/server/compliance/identity";
import { rateLimitResponse } from "@/server/rate-limit";
import { apiError } from "@/server/api";

/** POST /api/identity/start: begin identity verification with the configured provider. */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const limited = rateLimitResponse(`identity:${userId}`, 5, 3_600_000);
    if (limited) return limited;
    const returnUrl = new URL("/account", req.url).toString();
    const r = await startVerification(userId, returnUrl);
    return NextResponse.json({ status: r.verification.status, redirectUrl: r.redirectUrl ?? null });
  } catch (e) {
    return apiError(e);
  }
}
