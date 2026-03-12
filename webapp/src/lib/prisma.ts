import { PrismaClient } from "@prisma/client";
import { validateDatabaseEnvironment } from "@/src/lib/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

validateDatabaseEnvironment();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
