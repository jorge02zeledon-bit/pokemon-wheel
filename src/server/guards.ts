import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "./db";
import { config } from "./config";

/**
 * Server-side authorization guards. Use these in server components, server
 * actions and route handlers. Never rely on the proxy or the UI alone.
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

/** Returns the session user id or throws. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user.id;
}

/** Loads the full user row for the current session or throws. */
export async function requireUser() {
  const id = await requireUserId();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new UnauthorizedError("Account not found");
  return user;
}

/** Like requireUser but re-checks the ADMIN role in the database. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ForbiddenError();
  return user;
}

/**
 * Hard server-side gate for deposits, withdrawals and shipping.
 * Call at the top of every real-money code path.
 */
export function requireRealMoney(): void {
  if (!config.realMoneyEnabled) throw new RealMoneyDisabledError();
}

/** Page helpers: redirect instead of throwing. */
export async function requireUserOrRedirect() {
  try {
    return await requireUser();
  } catch {
    redirect("/login");
  }
}

export async function requireAdminOrRedirect() {
  const user = await requireUserOrRedirect();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
