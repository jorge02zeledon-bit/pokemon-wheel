import { config } from "./config";

/**
 * Authorization errors and the real-money gate. Kept free of Next.js and
 * Auth.js imports so domain modules and tests can use them directly.
 */

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown by any real-money code path while REAL_MONEY_ENABLED=false. */
export class RealMoneyDisabledError extends Error {
  constructor() {
    super("Real-money features are disabled: the site is in demo mode");
    this.name = "RealMoneyDisabledError";
  }
}

/**
 * Hard server-side gate for deposits, withdrawals and shipping.
 * Call at the top of every real-money code path.
 */
export function requireRealMoney(): void {
  if (!config.realMoneyEnabled) throw new RealMoneyDisabledError();
}
