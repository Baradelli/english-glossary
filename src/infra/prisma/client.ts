import { PrismaClient } from "@prisma/client";

/**
 * Process-wide PrismaClient singleton. The global guard prevents connection
 * exhaustion under dev hot-reload (relevant once Next.js arrives in step 3).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
