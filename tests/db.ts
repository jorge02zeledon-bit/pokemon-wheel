import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Test database helpers. `resetDb` truncates every table (TRUNCATE bypasses
 * the append-only triggers, which is intended for test isolation only).
 */
export const testPrisma = new PrismaClient();

const TABLES = [
  "AdminAuditLog", "LedgerEntry", "VaultItem", "Spin", "Order", "Deposit", "Withdrawal",
  "IdentityVerification", "PlayLimit", "SelfExclusion", "TierProduct", "Tier", "Wheel",
  "Product", "BlockedState", "Setting", "PasswordResetToken", "User",
];

export async function resetDb() {
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

/** Run the real seed script against the test database. */
export function seedDb() {
  execSync("npx tsx prisma/seed.ts", {
    env: { ...process.env, ADMIN_EMAIL: "admin@test.local", ADMIN_PASSWORD: "test-admin-password" },
    stdio: "ignore",
  });
}
