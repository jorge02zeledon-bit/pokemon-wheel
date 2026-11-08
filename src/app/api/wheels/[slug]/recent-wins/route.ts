import { NextResponse } from "next/server";
import { listRecentWins } from "@/server/wheels/recent-wins";
import { apiError } from "@/server/api";

/** GET /api/wheels/:slug/recent-wins: public feed of the latest wins on a wheel (names masked). */
export async function GET(_req: Request, ctx: RouteContext<"/api/wheels/[slug]/recent-wins">) {
  try {
    const { slug } = await ctx.params;
    return NextResponse.json(await listRecentWins({ wheelSlug: slug }));
  } catch (e) {
    return apiError(e);
  }
}
