import { randomUUID } from "node:crypto";
import type { IdentityProvider, StartResult, VerificationUpdate } from "./IdentityProvider";

/**
 * Development stand-in for a KYC vendor. Starts PENDING and auto-approves
 * once MOCK_IDENTITY_DELAY_SECONDS (default 10) have elapsed, when polled.
 * Set MOCK_IDENTITY_OUTCOME=REJECTED to exercise the rejection path.
 * Admins can also approve/reject manually from the user page.
 */
export class MockIdentityProvider implements IdentityProvider {
  readonly name = "mock";
  private readonly delayMs = Number(process.env.MOCK_IDENTITY_DELAY_SECONDS ?? 10) * 1000;

  async start(): Promise<StartResult> {
    return { providerRef: `mock_${randomUUID()}`, status: "PENDING" };
  }

  async poll(providerRef: string, startedAt: Date): Promise<VerificationUpdate | null> {
    if (Date.now() - startedAt.getTime() < this.delayMs) return null;
    const rejected = process.env.MOCK_IDENTITY_OUTCOME === "REJECTED";
    return { providerRef, status: rejected ? "REJECTED" : "APPROVED", reason: rejected ? "Mock rejection (MOCK_IDENTITY_OUTCOME)" : "Mock auto-approval" };
  }

  async parseWebhook(): Promise<null> {
    return null; // the mock has no webhooks
  }
}
