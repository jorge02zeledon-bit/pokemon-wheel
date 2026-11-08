import { config } from "@/server/config";
import type { MailMessage, MailProvider } from "./MailProvider";
import { ConsoleMailProvider } from "./ConsoleMailProvider";
import { ResendMailProvider } from "./ResendMailProvider";

let instance: MailProvider | null = null;

export function getMailProvider(): MailProvider {
  if (instance) return instance;
  switch (config.mailProvider) {
    case "console": instance = new ConsoleMailProvider(); break;
    case "resend": instance = new ResendMailProvider(); break;
    default: throw new Error(`Unknown MAIL_PROVIDER "${config.mailProvider}"`);
  }
  return instance;
}

/** Fire-and-forget send: email must never break a user action. */
export function sendMailSafe(message: MailMessage): void {
  getMailProvider().send(message).catch((e) => console.error("mail send failed", e));
}
