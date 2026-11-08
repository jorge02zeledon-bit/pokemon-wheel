import { config } from "@/server/config";
import type { PaymentProvider } from "./PaymentProvider";
import { TestPaymentProvider } from "./TestPaymentProvider";

let instance: PaymentProvider | null = null;

/** Payment provider selected by PAYMENT_PROVIDER. Only "test" ships. */
export function getPaymentProvider(): PaymentProvider {
  if (instance) return instance;
  switch (config.paymentProvider) {
    case "test":
      instance = new TestPaymentProvider();
      break;
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER "${config.paymentProvider}". Implement it under src/server/providers/payment/ after legal review.`);
  }
  return instance;
}

export type { PaymentProvider, PaymentOutcome, PaymentWebhookEvent } from "./PaymentProvider";
