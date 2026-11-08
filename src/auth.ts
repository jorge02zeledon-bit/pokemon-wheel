import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { authConfig } from "./auth.config";
import { prisma } from "./server/db";
import { loginSchema } from "./lib/validation/auth";

/**
 * Email + password authentication.
 *
 * `authorize` does a constant-ish time check: we always run bcrypt compare
 * against either the stored hash or a dummy hash so timing does not reveal
 * whether an email exists.
 */
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8Zz7Fq3Ql6Z1k8Gq9m7XGz0b3O7p8e"; // never matches

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        const ok = await compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok) return null;
        return { id: user.id, email: user.email, name: user.displayName, role: user.role };
      },
    }),
  ],
});
