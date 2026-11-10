import { NextResponse } from "next/server";
import { requireUserId } from "@/server/guards";
import { updateProfile } from "@/server/account/profile";
import { apiError, readJson } from "@/server/api";

/** POST /api/account/profile { displayName?, stateCode? } */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    return NextResponse.json(await updateProfile(userId, await readJson(req)));
  } catch (e) {
    return apiError(e);
  }
}
