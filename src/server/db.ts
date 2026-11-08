import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client for the process. In development Next.js hot-reloads
 * modules, so we cache the instance on `globalThis` to avoid exhausting
 * database connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Transaction client type, for functions that must run inside a transaction. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
