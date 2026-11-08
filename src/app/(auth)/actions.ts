"use server";

import { AuthError } from "next-auth";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn } from "@/auth";
import { prisma } from "@/server/db";
import { isDemoMode } from "@/server/config";
import { getSettings } from "@/server/settings";
import { applyLedgerEntry } from "@/server/wallet/ledger";
import { generateClientSeed, generateServerSeed, hashServerSeed } from "@/server/engine/fair";
import { signupSchema } from "@/lib/validation/auth";

export type AuthFormState = {
  errors?: Record<string, string[]>;
  message?: string;
} | undefined;

/**
 * Create an account. Requires the 18+ confirmation and a US state. New users
 * receive starting demo credits while the site is in demo mode.
 */
export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
    stateCode: formData.get("stateCode"),
    ageConfirmed: formData.get("ageConfirmed") === "on",
    termsAccepted: formData.get("termsAccepted") === "on",
  });
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (errors[key] ??= []).push(issue.message);
    }
    return { errors };
  }
  const { email, password, displayName, stateCode } = parsed.data;

  try {
    const settings = await getSettings();
    const serverSeed = generateServerSeed();
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: await hash(password, 12),
          displayName,
          stateCode,
          ageConfirmedAt: new Date(),
          clientSeed: generateClientSeed(),
          nextServerSeed: serverSeed,
          nextServerSeedHash: hashServerSeed(serverSeed),
        },
      });
      if (isDemoMode() && settings.demoStartingCreditsCents > 0) {
        await applyLedgerEntry(tx, {
          userId: user.id,
          type: "DEMO_GRANT",
          amountCents: settings.demoStartingCreditsCents,
          isDemo: true,
          description: "Welcome demo credits",
        });
        await tx.user.update({ where: { id: user.id }, data: { lastDemoRefillAt: new Date() } });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { email: ["An account with this email already exists"] } };
    }
    throw e;
  }

  await signIn("credentials", { email, password, redirectTo: "/" });
  return undefined;
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: (formData.get("next") as string) || "/",
    });
    return undefined;
  } catch (e) {
    if (isRedirectError(e)) throw e; // successful sign-in redirects via a thrown error
    if (e instanceof AuthError) return { message: "Incorrect email or password" };
    throw e;
  }
}
