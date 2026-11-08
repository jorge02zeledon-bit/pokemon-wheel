import { NextResponse } from "next/server";
import { requireUserId } from "@/server/guards";
import { refreshVerification } from "@/server/compliance/identity";
import { apiError } from "@/server/api";

/** GET /api/identity/status: poll the provider for a pending verification and return the current status. */
export async function GET() {
  try {
    const r = await refreshVerification(await requireUserId());
    return NextResponse.json({ status: r.status, reason: r.latest?.reason ?? null, updatedAt: r.latest?.updatedAt ?? null });
  } catch (e) {
    return apiError(e);
  }
}
