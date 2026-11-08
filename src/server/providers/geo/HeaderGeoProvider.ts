import { US_STATE_CODES } from "@/lib/us-states";
import type { GeoProvider, GeoResult } from "./GeoProvider";

/**
 * Uses the geolocation headers that Vercel and Cloudflare attach at the edge.
 * Free and fast; accuracy is the platform's. Only trust these headers when the
 * app is actually behind that platform, since a client could otherwise forge them.
 *   Vercel:     x-vercel-ip-country, x-vercel-ip-country-region
 *   Cloudflare: cf-ipcountry, cf-region-code
 */
export class HeaderGeoProvider implements GeoProvider {
  readonly name = "header";
  async lookup({ headers }: { ip: string | null; headers: Headers }): Promise<GeoResult> {
    const country = (headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry"))?.toUpperCase() ?? null;
    const region = (headers.get("x-vercel-ip-country-region") ?? headers.get("cf-region-code"))?.toUpperCase() ?? null;
    const source = headers.has("x-vercel-ip-country") ? "vercel" : headers.has("cf-ipcountry") ? "cloudflare" : "header:none";
    if (!country || country === "XX") return { countryCode: null, stateCode: null, source };
    const stateCode = country === "US" && region && US_STATE_CODES.has(region) ? region : null;
    return { countryCode: country, stateCode, source };
  }
}
