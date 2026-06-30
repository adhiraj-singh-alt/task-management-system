import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env, isProduction } from "../config/env.js";

/**
 * Single shared PrismaClient. Prisma 7's query compiler connects through a
 * driver adapter (node-postgres) rather than reading DATABASE_URL itself.
 *
 * In development we cache the instance on `globalThis` so `tsx watch` hot
 * reloads don't open a new connection pool on every change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
