/**
 * Process-level configuration read from environment variables.
 *
 * Anything here is fixed for the lifetime of the process. Values an admin
 * should be able to change at runtime live in the Setting table instead
 * (see ./settings.ts).
 */

function flag(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export const config = {
  /**
   * LAUNCH MODE SWITCH.
   * false => DEMO MODE: free demo credits, no deposits, withdrawals or shipping.
   * Checked on the server by `requireRealMoney()`; the UI only mirrors it.
   */
  realMoneyEnabled: flag("REAL_MONEY_ENABLED", false),

  paymentProvider: process.env.PAYMENT_PROVIDER ?? "test",
  identityProvider: process.env.IDENTITY_PROVIDER ?? "mock",
  geoProvider: process.env.GEO_PROVIDER ?? "mock",
  storageProvider: process.env.STORAGE_PROVIDER ?? "local",
  mailProvider: process.env.MAIL_PROVIDER ?? "console",

  jobsSecret: process.env.JOBS_SECRET ?? "",
  siteName: "HonshuWheel",
} as const;

/** True while the site is in demo mode (the inverse of realMoneyEnabled). */
export function isDemoMode(): boolean {
  return !config.realMoneyEnabled;
}
