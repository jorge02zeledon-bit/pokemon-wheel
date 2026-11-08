import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { config } from "@/server/config";
import { processExpiredVaultItems } from "@/server/vault/expiry";
import { apiError } from "@/server/api";

/**
 * Vault expiry job. Call hourly from any scheduler:
 *   GET/POST /api/jobs/vault-expiry   with  Authorization: Bearer <JOBS_SECRET>
 * Vercel Cron sends GET with the CRON_SECRET as a bearer token; set
 * JOBS_SECRET to the same value.
 */
function authorized(req: Request): boolean {
  const secret = config.jobsSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  try {
    if (!authorized(req)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const result = await processExpiredVaultItems();
    return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
  } catch (e) {
    return apiError(e);
  }
}

export const GET = run;
export const POST = run;
