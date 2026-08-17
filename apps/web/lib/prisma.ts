import { PrismaClient } from "@prisma/client";

// One client for the whole app. Use the pooled Neon connection string at
// runtime; the direct string is only for migrations.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
