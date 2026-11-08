/**
 * IP geolocation abstraction used to enforce state restrictions.
 * Implementations: mock (dev header), header (Vercel/Cloudflare edge headers),
 * maxmind (GeoIP2 web service).
 */
export interface GeoResult {
  /** ISO 3166-1 alpha-2 country, e.g. "US", or null when unknown. */
  countryCode: string | null;
  /** US state/territory code when the country is US, otherwise null. */
  stateCode: string | null;
  /** Which provider / signal produced the answer, for the audit trail. */
  source: string;
}

export interface GeoProvider {
  readonly name: string;
  lookup(input: { ip: string | null; headers: Headers }): Promise<GeoResult>;
}

/** Client IP from standard proxy headers. */
export function clientIpFromHeaders(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || null;
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? null;
}
