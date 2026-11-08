import { isDemoMode } from "@/server/config";
import { US_STATE_CODES } from "@/lib/us-states";
import type { GeoProvider, GeoResult } from "./GeoProvider";

/**
 * Development provider. In demo mode it honours an `x-demo-state` request
 * header (e.g. "WA") so blocking can be tested; otherwise it reports unknown.
 * It never claims a location it does not know, so it can never wrongly block.
 */
export class MockGeoProvider implements GeoProvider {
  readonly name = "mock";
  async lookup({ headers }: { ip: string | null; headers: Headers }): Promise<GeoResult> {
    const demo = headers.get("x-demo-state")?.toUpperCase();
    if (isDemoMode() && demo && US_STATE_CODES.has(demo)) return { countryCode: "US", stateCode: demo, source: "mock:x-demo-state" };
    if (isDemoMode() && demo === "XX") return { countryCode: "CA", stateCode: null, source: "mock:x-demo-state" };
    return { countryCode: null, stateCode: null, source: "mock:unknown" };
  }
}
