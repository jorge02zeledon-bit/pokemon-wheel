import { NextResponse } from "next/server";
import { requireUserId } from "@/server/guards";
import { getFairState } from "@/server/engine/spin";
import { apiError } from "@/server/api";

/** GET /api/fair/state: the commitment (server seed hash), client seed and nonce for the user's next spin. */
export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json(await getFairState(userId));
  } catch (e) {
    return apiError(e);
  }
}
