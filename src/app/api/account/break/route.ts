import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/server/guards";
import { takeBreak } from "@/server/compliance/exclusion";
import { apiError, readJson } from "@/server/api";

/** POST /api/account/break { hours }: start a cooldown (24, 72 or 168 hours). Cannot be shortened. */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const { hours } = z.object({ hours: z.number().int() }).parse(await readJson(req));
    return NextResponse.json(await takeBreak(userId, hours));
  } catch (e) {
    return apiError(e);
  }
}
