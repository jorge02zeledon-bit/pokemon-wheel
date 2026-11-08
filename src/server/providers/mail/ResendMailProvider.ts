import type { MailMessage, MailProvider } from "./MailProvider";

/** Resend (https://resend.com) via its REST API. Needs RESEND_API_KEY and MAIL_FROM. */
export class ResendMailProvider implements MailProvider {
  readonly name = "resend";
  private readonly key: string;
  private readonly from: string;
  constructor() {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;
    if (!key || !from) throw new Error("Resend mail: set RESEND_API_KEY and MAIL_FROM");
    this.key = key;
    this.from = from;
  }
  async send(m: MailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${this.key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}
