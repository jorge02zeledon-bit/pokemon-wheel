export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Transactional email abstraction. Implementations: console (dev), resend. */
export interface MailProvider {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}
