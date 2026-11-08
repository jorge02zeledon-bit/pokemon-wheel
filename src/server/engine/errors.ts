/**
 * Domain errors thrown by the spin engine. The API layer maps these to HTTP
 * status codes (see src/server/api.ts); everything else is a 500.
 */

export class WheelUnavailableError extends Error {
  constructor(message = "This wheel is not available right now") {
    super(message);
    this.name = "WheelUnavailableError";
  }
}

/** A prize the wheel can award has no stock. The spin is refused before any charge. */
export class OutOfStockError extends WheelUnavailableError {
  constructor(public readonly productNames: string[]) {
    super(
      productNames.length === 1
        ? `This wheel is paused: "${productNames[0]}" is out of stock`
        : `This wheel is paused: ${productNames.length} prizes are out of stock`,
    );
    this.name = "OutOfStockError";
  }
}

export type IneligibleReason =
  | "AGE_NOT_CONFIRMED"
  | "NO_STATE"
  | "BLOCKED_STATE"
  | "BLOCKED_IP_STATE"
  | "SELF_EXCLUDED"
  | "COOLDOWN"
  | "SPEND_LIMIT";

export class NotEligibleError extends Error {
  constructor(
    public readonly reason: IneligibleReason,
    message: string,
    /** When the restriction lifts, if it does. */
    public readonly until?: Date,
  ) {
    super(message);
    this.name = "NotEligibleError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
