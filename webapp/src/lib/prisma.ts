import "server-only";
import { PrismaClient } from "@prisma/client";
import { validateDatabaseEnvironment } from "@/src/lib/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
let prismaClient: PrismaClient | undefined = globalForPrisma.prisma;

function getPrismaClient() {
  if (prismaClient) {
    return prismaClient;
  }

  validateDatabaseEnvironment();

  prismaClient = new PrismaClient({
    log: ["error", "warn"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaClient;
  }

  return prismaClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(getPrismaClient(), property, receiver);
  },
  set(_target, property, value, receiver) {
    return Reflect.set(getPrismaClient(), property, value, receiver);
  },
});
