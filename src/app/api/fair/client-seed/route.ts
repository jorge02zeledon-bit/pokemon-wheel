import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/server/guards";
import { CLIENT_SEED_PATTERN, getFairState, setClientSeed } from "@/server/engine/spin";
import { apiError, readJson } from "@/server/api";

const bodySchema = z.object({
  clientSeed: z.string().regex(CLIENT_SEED_PATTERN, "Client seed must be 8-64 letters, numbers, '-' or '_'"),
});

/** POST /api/fair/client-seed { clientSeed }: change the user's client seed for future spins. */
export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const { clientSeed } = bodySchema.parse(await readJson(req));
    await setClientSeed(userId, clientSeed);
    return NextResponse.json(await getFairState(userId));
  } catch (e) {
    return apiError(e);
  }
}
