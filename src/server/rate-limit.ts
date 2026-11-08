import { NextResponse } from "next/server";

/**
 * Small in-memory sliding-window rate limiter.
 *
 * Good enough to stop accidental or scripted hammering of auth and spin
 * endpoints on a single server. On serverless (Vercel) each instance has its
 * own memory, so limits are per instance and advisory; for hard guarantees
 * swap `hit` for a shared store (Upstash Redis / Vercel KV) with the same
 * signature. The spin engine's row locks and balance checks remain the real
 * safety net regardless.
 */
const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

export interface RateLimitResult { ok: boolean; remaining: number; retryAfterSeconds: number }

export function hit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (now - lastSweep > 60_000) {
    for (const [k, arr] of buckets) if (arr.length === 0 || arr[arr.length - 1] < now - windowMs) buckets.delete(k);
    lastSweep = now;
  }
  const arr = (buckets.get(key) ?? []).filter((t) => t > now - windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000)) };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true, remaining: limit - arr.length, retryAfterSeconds: 0 };
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Returns a 429 response when over the limit, otherwise null. */
export function rateLimitResponse(key: string, limit: number, windowMs: number): NextResponse | null {
  const r = hit(key, limit, windowMs);
  if (r.ok) return null;
  return NextResponse.json(
    { error: "RATE_LIMITED", message: `Too many requests. Try again in ${r.retryAfterSeconds}s.` },
    { status: 429, headers: { "retry-after": String(r.retryAfterSeconds) } },
  );
}

/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}
