import { beforeEach, describe, expect, it } from "vitest";
import { hit, resetRateLimits } from "@/server/rate-limit";

describe("rate limiter", () => {
  beforeEach(resetRateLimits);
  it("allows up to the limit within the window, then refuses with a retry hint", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(hit("k", 5, 60_000, t0 + i).ok).toBe(true);
    const r = hit("k", 5, 60_000, t0 + 10);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSeconds).toBe(60);
    expect(hit("other", 5, 60_000, t0).ok).toBe(true); // independent keys
  });
  it("slides: old hits fall out of the window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) hit("k", 3, 1000, t0 + i);
    expect(hit("k", 3, 1000, t0 + 500).ok).toBe(false);
    expect(hit("k", 3, 1000, t0 + 1001).ok).toBe(true);
  });
});
