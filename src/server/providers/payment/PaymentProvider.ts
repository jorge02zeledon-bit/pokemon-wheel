/**
 * Payment processing abstraction. No processor is wired: many processors
 * prohibit chance-based products, so the choice is made after legal review.
 * Implement this interface for the chosen processor and register it in
 * ./index.ts. Only the TestPaymentProvider ships.
 *
 * Money is integer cents. All methods are called only after
 * `requireRealMoney()` has passed.
 */
export type PaymentOutcome = "SUCCEEDED" | "PENDING" | "FAILED";

export interface CreateDepositResult {
  providerRef: string;
  status: PaymentOutcome;
  /** For hosted checkouts: send the user here to pay. */
  redirectUrl?: string;
}

export interface CreateWithdrawalResult {
  providerRef: string;
  status: PaymentOutcome;
}

export interface PaymentWebhookEvent {
  kind: "deposit" | "withdrawal";
  providerRef: string;
  status: PaymentOutcome;
  raw?: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createDeposit(input: { depositId: string; userId: string; amountCents: number; returnUrl: string }): Promise<CreateDepositResult>;
  createWithdrawal(input: { withdrawalId: string; userId: string; amountCents: number; destination: Record<string, string> }): Promise<CreateWithdrawalResult>;
  /** Validate signature and decode. Throw on bad signature. */
  parseWebhook(req: Request): Promise<PaymentWebhookEvent | null>;
}
