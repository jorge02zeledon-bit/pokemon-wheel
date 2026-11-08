import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Database-backed tests share one Postgres schema, so run files serially.
    fileParallelism: false,
    testTimeout: 60_000,
  },
});
