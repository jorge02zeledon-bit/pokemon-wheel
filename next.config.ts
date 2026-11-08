import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Security headers. The CSP allows inline scripts/styles because Next.js and
 * Tailwind emit them; tighten with nonces if a stricter policy is required.
 * img-src allows https: so product photos can come from R2/S3.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (isProd ? "" : " 'unsafe-eval'"),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  poweredByHeader: false,
  // Almost every page is per-user and reads live balances, stock and
  // sessions, so we use classic request-time rendering rather than
  // Cache Components. Static-friendly pages opt in to caching individually.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
