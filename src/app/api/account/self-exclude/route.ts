import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/server/guards";
import { selfExclude } from "@/server/compliance/exclusion";
import { apiError, readJson } from "@/server/api";

/** POST /api/account/self-exclude { duration, confirmation }: irreversible by the user. */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const { duration, confirmation } = z.object({ duration: z.enum(["DAYS_30", "MONTHS_6", "PERMANENT"]), confirmation: z.string() }).parse(await readJson(req));
    const ex = await selfExclude(userId, duration, confirmation);
    return NextResponse.json({ duration: ex.duration, startsAt: ex.startsAt, endsAt: ex.endsAt });
  } catch (e) {
    return apiError(e);
  }
}
