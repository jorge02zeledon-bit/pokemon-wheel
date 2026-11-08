import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { prisma } from "../db";
import { sendMailSafe } from "../providers/mail";
import { ValidationError } from "../engine/errors";
import { passwordSchema } from "@/lib/validation/auth";

const TTL_MS = 60 * 60 * 1000;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * Request a reset link. Always resolves the same way whether or not the email
 * exists, so the endpoint cannot be used to enumerate accounts.
 */
export async function requestPasswordReset(email: string, baseUrl: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return;
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + TTL_MS) } });
  const url = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
  sendMailSafe({
    to: user.email,
    subject: "Reset your HonshuWheel password",
    text: `Someone asked to reset the password for this HonshuWheel account. If that was you, open this link within one hour:\n\n${url}\n\nIf not, ignore this email; your password is unchanged.`,
  });
}

/** Consume a token and set a new password. Tokens are single-use and expire. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid password");
  const passwordHash = await hash(parsed.data, 12);
  await prisma.$transaction(async (tx) => {
    const row = await tx.passwordResetToken.findUnique({ where: { tokenHash: sha(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new ValidationError("This reset link is invalid or has expired");
    // Claim the token atomically so two parallel submits cannot both succeed.
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new ValidationError("This reset link has already been used");
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } });
  });
}
