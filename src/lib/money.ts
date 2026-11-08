/**
 * Money helpers. All amounts are integer cents; these helpers exist so the
 * rest of the codebase never does float arithmetic on money.
 */

export const BPS_SCALE = 10_000; // 100% in basis points

/** Format integer cents as a US dollar string, e.g. 123456 -> "$1,234.56". */
export function formatCents(cents: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isInteger(cents)) throw new TypeError(`formatCents expects integer cents, got ${cents}`);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const dollarStr = dollars.toLocaleString("en-US");
  if (opts.compact && rem === 0) return `${sign}$${dollarStr}`;
  return `${sign}$${dollarStr}.${rem.toString().padStart(2, "0")}`;
}

/** Parse a user-entered dollar string ("12.5", "$1,234.56") into integer cents. */
export function parseDollarsToCents(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^-?\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === "" || cleaned === "-") {
    throw new Error(`Invalid dollar amount: ${input}`);
  }
  const negative = cleaned.startsWith("-");
  const [whole = "0", frac = ""] = cleaned.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -cents : cents;
}

/**
 * Apply a percentage to cents, rounding half up to the nearest cent.
 * percentOfCents(14000, 80) -> 11200
 */
export function percentOfCents(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

/** Apply basis points to cents, rounding to the nearest cent. */
export function bpsOfCents(cents: number, bps: number): number {
  return Math.round((cents * bps) / BPS_SCALE);
}

/** Convert a percentage (e.g. 12.5) to basis points (1250). */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/** Convert basis points to a percentage string for display, e.g. 1250 -> "12.5%". */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "")}%`;
}
