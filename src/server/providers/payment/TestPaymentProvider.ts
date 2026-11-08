import type { CreateDepositResult, CreateWithdrawalResult, PaymentProvider } from "./PaymentProvider";

/**
 * Fake processor for development and tests. Deposits succeed instantly;
 * withdrawals stay PENDING until an admin marks them paid. Set
 * TEST_PAYMENT_FAIL=true to make every deposit fail.
 */
export class TestPaymentProvider implements PaymentProvider {
  readonly name = "test";

  async createDeposit({ depositId }: { depositId: string }): Promise<CreateDepositResult> {
    const fail = process.env.TEST_PAYMENT_FAIL === "true";
    return { providerRef: `test_dep_${depositId}`, status: fail ? "FAILED" : "SUCCEEDED" };
  }

  async createWithdrawal({ withdrawalId }: { withdrawalId: string }): Promise<CreateWithdrawalResult> {
    return { providerRef: `test_wd_${withdrawalId}`, status: "PENDING" };
  }

  async parseWebhook(): Promise<null> {
    return null;
  }
}
