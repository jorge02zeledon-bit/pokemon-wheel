import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "./db";
import { UnauthorizedError, ForbiddenError } from "./errors";

/**
 * Server-side authorization guards. Use these in server components, server
 * actions and route handlers. Never rely on the proxy or the UI alone.
 */

export { UnauthorizedError, ForbiddenError, RealMoneyDisabledError, requireRealMoney } from "./errors";

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
