import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJson } from "@/server/api";
import { oddsSnapshotSchema } from "@/server/engine/snapshot";
import { verifySpin } from "@/server/engine/verify";

const bodySchema = z.object({
  serverSeed: z.string().min(1).max(256),
  serverSeedHash: z.string().length(64),
  clientSeed: z.string().min(1).max(128),
  nonce: z.number().int().min(0),
  snapshot: oddsSnapshotSchema,
});

/**
 * POST /api/fair/verify
 * Public, stateless verifier: recomputes a spin outcome from the inputs. Needs
 * no login and touches no data, so anyone can check any published spin.
 */
export async function POST(req: Request) {
  try {
    const input = bodySchema.parse(await readJson(req));
    return NextResponse.json(verifySpin(input));
  } catch (e) {
    return apiError(e);
  }
}
