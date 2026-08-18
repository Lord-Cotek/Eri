#!/usr/bin/env node
/**
 * Apply pending migrations during the Vercel build.
 *
 * A thin wrapper around `prisma migrate deploy` that does three things the bare
 * command cannot:
 *
 *   1. Finds the connection string under whatever name it actually has. The
 *      Neon integration names its variables after the store (`eri_DATABASE_URL`),
 *      and Vercel withholds Sensitive variables from the build step entirely.
 *      See lib/database-url.mjs.
 *   2. Prefers a direct connection — DDL and advisory locks do not survive a
 *      transaction-mode pooler reliably.
 *   3. Says which variable it used and which host it reached, so the build log
 *      shows what was migrated instead of leaving it to be inferred.
 *
 * It also leaves Preview deployments alone by default — see the guard below.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load `.env` the way `prisma migrate deploy` used to before this wrapper
 * existed, so running it by hand still works locally. Real environment
 * variables win — on Vercel there is no `.env` and this is a no-op.
 */
function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  }
}

loadDotEnv();

const { allCandidateNames, describe, resolveMigrationUrl } = await import("../lib/database-url.mjs");

const migration = resolveMigrationUrl();

if (!migration) {
  process.stderr.write(
    [
      "",
      "Cannot apply migrations: no database connection string in the environment.",
      "",
      "Looked for these names, and for any variable ending in one of them —",
      "which is how an integration-created variable is named (eri_DATABASE_URL):",
      "",
      ...allCandidateNames().map((name) => `  ${name}`),
      "",
      "On Vercel, check two things:",
      "  1. DATABASE_URL exists for this environment (Production and Preview).",
      "  2. It is NOT marked Sensitive. Vercel withholds Sensitive variables from",
      "     the build step, so a migration cannot see them.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

/**
 * Preview deployments do not migrate by default.
 *
 * A Vercel build only ever sees its own environment's variables, so a preview
 * cannot compare its database against production's and cannot tell whether it
 * has one of its own. Given that, the safe default is not to migrate: a branch
 * carrying a new migration would otherwise apply it to live data the moment
 * somebody opened its preview, before anyone had reviewed it.
 *
 * The cost is that a preview of a schema change runs against the old schema and
 * may error. That is the right way round — a broken preview is recoverable, a
 * migrated production database is not.
 *
 * If previews have their own database (the Neon integration can branch one per
 * deployment), set ERI_ALLOW_PREVIEW_MIGRATE=1 and they will migrate too.
 */
if (process.env.VERCEL_ENV === "preview" && !process.env.ERI_ALLOW_PREVIEW_MIGRATE) {
  process.stdout.write(
    [
      "",
      "Skipping migrations: Preview deployment.",
      "",
      "A preview cannot see Production's configuration, so it cannot tell whether",
      "it shares Production's database. Rather than risk applying an unreviewed",
      "migration to live data, previews leave the schema alone.",
      "",
      "If previews have their own database — the Neon integration can branch one",
      "per deployment — set ERI_ALLOW_PREVIEW_MIGRATE=1.",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

process.stdout.write(`\nApplying migrations · ${migration.from} → ${describe(migration.url)}\n\n`);

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: migration.url },
});

process.exit(result.status ?? 1);
