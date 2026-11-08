import { z } from "zod";
import { US_STATE_CODES } from "../us-states";

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password is too long");

export const signupSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: passwordSchema,
  displayName: z.string().trim().min(2, "Display name is too short").max(32, "Display name is too long"),
  stateCode: z.string().refine((c) => US_STATE_CODES.has(c), "Select your state"),
  /** Must be the literal "on"/"true": the user ticked the 18+ confirmation. */
  ageConfirmed: z.literal(true, { error: "You must confirm you are 18 or older" }),
  termsAccepted: z.literal(true, { error: "You must accept the Terms of Service" }),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});
