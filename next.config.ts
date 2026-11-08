import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
