"use server";

import { headers } from "next/headers";
import { requestPasswordReset, resetPassword } from "@/server/auth/password-reset";
import { ValidationError } from "@/server/engine/errors";
import { hit } from "@/server/rate-limit";
import type { AuthFormState } from "./actions";

export async function forgotPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!hit(`forgot:${ip}`, 5, 3_600_000).ok) return { message: "Too many requests. Try again later." };
  const email = String(formData.get("email") ?? "");
  const base = process.env.AUTH_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  await requestPasswordReset(email, base);
  return { message: "If an account exists for that email, a reset link is on its way. It expires in one hour." };
}

export async function resetPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { errors: { confirm: ["Passwords do not match"] } };
  try {
    await resetPassword(token, password);
    return { message: "ok" };
  } catch (e) {
    if (e instanceof ValidationError) return { errors: { password: [e.message] } };
    throw e;
  }
}
