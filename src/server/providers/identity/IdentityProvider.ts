import type { VerificationStatus } from "@prisma/client";

/**
 * Identity (KYC) verification abstraction.
 *
 * Flow: `start` creates a session with the vendor and returns either a hosted
 * URL to send the user to, or nothing (vendor-less mock). Status changes
 * arrive via `parseWebhook` (vendor -> us) or `poll` (us -> vendor).
 *
 * Plugging in a vendor (Persona, Veriff, Stripe Identity): implement this
 * interface in a new file, map the vendor's statuses onto VerificationStatus,
 * verify webhook signatures in `parseWebhook`, and register it in ./index.ts.
 */
export interface StartResult {
  providerRef: string;
  status: VerificationStatus;
  /** Hosted verification page to redirect the user to, if the vendor has one. */
  redirectUrl?: string;
}

export interface VerificationUpdate {
  providerRef: string;
  status: VerificationStatus;
  reason?: string;
  raw?: unknown;
}

export interface IdentityProvider {
  readonly name: string;
  start(input: { userId: string; email: string; returnUrl: string }): Promise<StartResult>;
  /** Ask the vendor for the latest status. Return null when unchanged/unknown. */
  poll(providerRef: string, startedAt: Date): Promise<VerificationUpdate | null>;
  /** Validate and decode an inbound webhook. Throw on bad signature. */
  parseWebhook(req: Request): Promise<VerificationUpdate | null>;
}
