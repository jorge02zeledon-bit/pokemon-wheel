"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { hit } from "@/server/rate-limit";
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
import { sendMailSafe } from "@/server/providers/mail";

export type AuthFormState = {
  errors?: Record<string, string[]>;
  message?: string;
} | undefined;

/**
 * Create an account. Requires the 18+ confirmation and a US state. New users
 * receive starting demo credits while the site is in demo mode.
 */
async function ipKey(prefix: string): Promise<string> {
  const h = await headers();
  return `${prefix}:${h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown"}`;
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!hit(await ipKey("signup"), 10, 3_600_000).ok) return { message: "Too many sign-ups from this network. Try again later." };
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
        // The welcome grant does not start the refill cooldown, so a new player
        // who spends it all can refill right away.
        await applyLedgerEntry(tx, {
          userId: user.id,
          type: "DEMO_GRANT",
          amountCents: settings.demoStartingCreditsCents,
          isDemo: true,
          description: "Welcome demo credits",
        });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { email: ["An account with this email already exists"] } };
    }
    throw e;
  }

  sendMailSafe({
    to: email,
    subject: "Welcome to HonshuWheel",
    text: `Hi ${displayName},\n\nYour HonshuWheel account is ready. You must be 18+ to play. Set deposit limits or take a break any time from your account page. If gambling is a problem for you, call or text 1-800-GAMBLER.\n\nHonshuWheel is not affiliated with The Pokémon Company, Nintendo, Creatures, or Game Freak.`,
  });
  await signIn("credentials", { email, password, redirectTo: "/" });
  return undefined;
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!hit(await ipKey("login"), 20, 15 * 60_000).ok) return { message: "Too many login attempts. Try again in a few minutes." };
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
