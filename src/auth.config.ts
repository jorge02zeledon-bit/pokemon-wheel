import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Auth.js configuration that is safe to import from `proxy.ts`: no database
 * access and no Node-only dependencies. The Credentials provider (which needs
 * Prisma and bcrypt) is added in ./auth.ts.
 *
 * Sessions are stateless JWTs containing the user id and role. Role changes
 * take effect on next login; privileged server code re-checks the role in the
 * database anyway (see server/guards.ts).
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const loggedIn = !!auth?.user;
      const isAdminRoute = pathname.startsWith("/admin");
      const isUserRoute = ["/vault", "/wallet", "/account"].some((p) => pathname.startsWith(p));
      if (isAdminRoute) {
        if (!loggedIn) return false; // redirects to /login
        if (auth?.user.role !== "ADMIN") return Response.redirect(new URL("/", request.nextUrl));
        return true;
      }
      if (isUserRoute) return loggedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
