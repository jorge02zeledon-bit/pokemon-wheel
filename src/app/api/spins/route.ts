import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/server/guards";
import { executeSpin } from "@/server/engine/spin";
import { apiError, readJson } from "@/server/api";
import { locateRequest } from "@/server/providers/geo";

const bodySchema = z.object({ wheelSlug: z.string().min(1).max(64) });

/**
 * POST /api/spins  { wheelSlug }
 * Performs a spin for the signed-in user. The outcome is decided here, on the
 * server, before any animation plays. Returns the result plus the revealed
 * server seed and the hash of the next one.
 */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const { wheelSlug } = bodySchema.parse(await readJson(req));
    // Location from the GeoProvider: stated state AND detected state must both be allowed.
    const geo = await locateRequest(req.headers);
    const result = await executeSpin({ userId, wheelSlug, eligibility: { ipState: geo.stateCode, ipCountry: geo.countryCode } });
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
