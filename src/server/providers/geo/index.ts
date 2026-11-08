import { config } from "@/server/config";
import type { GeoProvider, GeoResult } from "./GeoProvider";
import { clientIpFromHeaders } from "./GeoProvider";
import { MockGeoProvider } from "./MockGeoProvider";
import { HeaderGeoProvider } from "./HeaderGeoProvider";
import { MaxMindGeoProvider } from "./MaxMindGeoProvider";

let instance: GeoProvider | null = null;

/** Geo provider selected by GEO_PROVIDER ("mock" | "header" | "maxmind"). */
export function getGeoProvider(): GeoProvider {
  if (instance) return instance;
  switch (config.geoProvider) {
    case "mock": instance = new MockGeoProvider(); break;
    case "header": instance = new HeaderGeoProvider(); break;
    case "maxmind": instance = new MaxMindGeoProvider(); break;
    default: throw new Error(`Unknown GEO_PROVIDER "${config.geoProvider}"`);
  }
  return instance;
}

/** Convenience: locate the caller of a request. */
export async function locateRequest(headers: Headers): Promise<GeoResult> {
  return getGeoProvider().lookup({ ip: clientIpFromHeaders(headers), headers });
}

export type { GeoProvider, GeoResult } from "./GeoProvider";
