import { US_STATE_CODES } from "@/lib/us-states";
import type { GeoProvider, GeoResult } from "./GeoProvider";

/**
 * MaxMind GeoIP2 web service (City or Insights). Needs MAXMIND_ACCOUNT_ID and
 * MAXMIND_LICENSE_KEY. Fails open to "unknown" on network errors, which the
 * eligibility check treats as "no IP signal" (the stated state still applies).
 * If counsel requires fail-closed behaviour, flip FAIL_CLOSED below.
 */
const FAIL_CLOSED = false;

export class MaxMindGeoProvider implements GeoProvider {
  readonly name = "maxmind";
  private readonly auth: string;
  constructor() {
    const id = process.env.MAXMIND_ACCOUNT_ID;
    const key = process.env.MAXMIND_LICENSE_KEY;
    if (!id || !key) throw new Error("MaxMind geo: set MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY");
    this.auth = Buffer.from(`${id}:${key}`).toString("base64");
  }

  async lookup({ ip }: { ip: string | null; headers: Headers }): Promise<GeoResult> {
    if (!ip || ip === "127.0.0.1" || ip === "::1") return { countryCode: null, stateCode: null, source: "maxmind:no-ip" };
    try {
      const res = await fetch(`https://geoip.maxmind.com/geoip/v2.1/city/${encodeURIComponent(ip)}`, {
        headers: { authorization: `Basic ${this.auth}`, accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`MaxMind ${res.status}`);
      const body = (await res.json()) as { country?: { iso_code?: string }; subdivisions?: { iso_code?: string }[] };
      const country = body.country?.iso_code?.toUpperCase() ?? null;
      const region = body.subdivisions?.[0]?.iso_code?.toUpperCase() ?? null;
      return { countryCode: country, stateCode: country === "US" && region && US_STATE_CODES.has(region) ? region : null, source: "maxmind" };
    } catch (e) {
      if (FAIL_CLOSED) throw e;
      console.error("MaxMind lookup failed", e);
      return { countryCode: null, stateCode: null, source: "maxmind:error" };
    }
  }
}
