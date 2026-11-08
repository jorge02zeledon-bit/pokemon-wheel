import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ForbiddenError, RealMoneyDisabledError, UnauthorizedError } from "./guards";
import { InsufficientFundsError } from "./wallet/ledger";
import { NotEligibleError, OutOfStockError, ValidationError, WheelUnavailableError } from "./engine/errors";
import { RefillNotAvailableError } from "./wallet/demo";

/**
 * Maps domain errors to JSON API responses. Unknown errors are logged and
 * returned as a generic 500 so internals never leak to the client.
 */
export function apiError(e: unknown): NextResponse {
  if (e instanceof ZodError) {
    return NextResponse.json({ error: "VALIDATION", message: e.issues[0]?.message ?? "Invalid input", issues: e.issues }, { status: 400 });
  }
  if (e instanceof ValidationError) return NextResponse.json({ error: "VALIDATION", message: e.message }, { status: 400 });
  if (e instanceof UnauthorizedError) return NextResponse.json({ error: "UNAUTHORIZED", message: e.message }, { status: 401 });
  if (e instanceof ForbiddenError) return NextResponse.json({ error: "FORBIDDEN", message: e.message }, { status: 403 });
  if (e instanceof RealMoneyDisabledError) return NextResponse.json({ error: "DEMO_MODE", message: e.message }, { status: 403 });
  if (e instanceof NotEligibleError) {
    return NextResponse.json({ error: "NOT_ELIGIBLE", reason: e.reason, message: e.message, until: e.until ?? null }, { status: 403 });
  }
  if (e instanceof InsufficientFundsError) {
    return NextResponse.json({ error: "INSUFFICIENT_FUNDS", message: e.message, isDemo: e.isDemo }, { status: 402 });
  }
  if (e instanceof OutOfStockError) {
    return NextResponse.json({ error: "OUT_OF_STOCK", message: e.message, products: e.productNames }, { status: 409 });
  }
  if (e instanceof RefillNotAvailableError) {
    return NextResponse.json({ error: "REFILL_NOT_AVAILABLE", message: e.message, availableAt: e.availableAt }, { status: 429 });
  }
  if (e instanceof WheelUnavailableError) return NextResponse.json({ error: "WHEEL_UNAVAILABLE", message: e.message }, { status: 409 });
  console.error("Unhandled API error", e);
  return NextResponse.json({ error: "INTERNAL", message: "Something went wrong" }, { status: 500 });
}

/** Parse a JSON body, tolerating an empty body. */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Body must be valid JSON");
  }
}
