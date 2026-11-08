import type { MailMessage, MailProvider } from "./MailProvider";

/** Logs emails to stdout instead of sending them. */
export class ConsoleMailProvider implements MailProvider {
  readonly name = "console";
  async send(m: MailMessage): Promise<void> {
    console.log(`[mail] to=${m.to} subject=${JSON.stringify(m.subject)}\n${m.text}`);
  }
}
