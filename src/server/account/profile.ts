import { z } from "zod";
import { prisma } from "../db";
import { US_STATE_CODES } from "@/lib/us-states";

/**
 * Profile edits a user may make themselves: display name and state of
 * residence. Changing the stated state never bypasses location checks: the
 * IP-derived state is still checked on every spin and recorded with it.
 */
export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Display name is too short").max(32, "Display name is too long").optional(),
  stateCode: z.string().refine((c) => US_STATE_CODES.has(c), "Select a valid US state").optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export async function updateProfile(userId: string, raw: unknown) {
  const input = profileSchema.parse(raw);
  return prisma.user.update({
    where: { id: userId },
    data: { ...(input.displayName !== undefined ? { displayName: input.displayName } : {}), ...(input.stateCode !== undefined ? { stateCode: input.stateCode } : {}) },
    select: { displayName: true, stateCode: true },
  });
}
