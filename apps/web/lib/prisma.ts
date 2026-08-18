import { PrismaClient } from "@prisma/client";

import { resolveRuntimeUrl } from "@/lib/database-url.mjs";

/**
 * One client for the whole app.
 *
 * The URL is passed explicitly rather than left to `env("DATABASE_URL")` in the
 * schema, so the app resolves it exactly the way the migration script does —
 * including under an integration-prefixed name like `eri_DATABASE_URL`. One
 * resolver, so the thing that migrates the database and the thing that queries
 * it cannot end up pointed at different databases.
 *
 * Pooled at runtime: serverless functions open many short-lived connections and
 * exhaust a direct one. Migrations use the direct string; see
 * lib/database-url.mjs.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function client(): PrismaClient {
  const resolved = resolveRuntimeUrl();
  // With nothing resolved, fall back to the schema's own env() lookup so the
  // failure comes from Prisma with its usual message rather than from here.
  return resolved
    ? new PrismaClient({ datasources: { db: { url: resolved.url } } })
    : new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? client();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
