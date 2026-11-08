import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Request proxy (Next.js 16 name for middleware).
 * Uses the lightweight auth config to redirect unauthenticated users away from
 * account routes and non-admins away from /admin. Server code still enforces
 * authorization on every data access; this is only the first gate.
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/admin/:path*", "/vault/:path*", "/wallet/:path*", "/account/:path*"],
};
