/**
 * Which connection string to use, and where to find it.
 *
 * `DATABASE_URL` is the name Ẹ̀rí asks for. But a Vercel project wired to Neon
 * through the integration gets its variables named after the *store*, not the
 * app — `eri_DATABASE_URL`, `eri_POSTGRES_PRISMA_URL` — and Vercel does not
 * expose variables marked **Sensitive** to the build step at all, only at
 * runtime. Either of those leaves `prisma migrate deploy` looking at an
 * environment with no `DATABASE_URL` in it, which is how the first deploy
 * failed.
 *
 * So: look for the name we asked for, then the names an integration actually
 * creates, then any variable whose name ends in a recognised suffix — and
 * report which one was used. Guessing silently would be worse than failing.
 *
 * Plain JavaScript on purpose. The build script runs before anything is
 * compiled and must be able to `import` this directly; the app reads the same
 * file, so there is one list of names rather than two that drift.
 */

/**
 * Pooled connections, for the app at runtime.
 *
 * Serverless functions open many short-lived connections and exhaust a direct
 * one. `POSTGRES_PRISMA_URL` ranks high because integrations build it with the
 * pgbouncer parameters Prisma wants.
 *
 * @type {readonly string[]}
 */
export const POOLED_CANDIDATES = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL"];

/**
 * Direct connections, for migrations.
 *
 * DDL and advisory locks do not survive a transaction-mode pooler reliably, so
 * `migrate deploy` prefers an unpooled string and falls back to a pooled one
 * only if that is all there is.
 *
 * @type {readonly string[]}
 */
export const DIRECT_CANDIDATES = ["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"];

/** @typedef {{ url: string, from: string }} Resolved */

/**
 * @param {string} key
 * @returns {string | undefined}
 */
function value(key) {
  const raw = process.env[key]?.trim();
  return raw ? raw : undefined;
}

/**
 * Find `name`, or any variable ending in `_${name}` — which is what an
 * integration-created variable looks like once prefixed with the store name.
 *
 * @param {string} name
 * @returns {Resolved | undefined}
 */
function findByName(name) {
  const direct = value(name);
  if (direct) return { url: direct, from: name };

  const suffix = `_${name}`;
  const key = Object.keys(process.env)
    .filter((candidate) => candidate.endsWith(suffix) && value(candidate))
    .sort()[0];

  const found = key ? value(key) : undefined;
  return key && found ? { url: found, from: key } : undefined;
}

/**
 * @param {readonly string[]} candidates
 * @returns {Resolved | undefined}
 */
function resolveFrom(candidates) {
  for (const name of candidates) {
    const found = findByName(name);
    if (found) return found;
  }
  return undefined;
}

/**
 * The connection string the app uses at runtime. Pooled.
 * @returns {Resolved | undefined}
 */
export function resolveRuntimeUrl() {
  return resolveFrom(POOLED_CANDIDATES);
}

/**
 * The connection string migrations use. Direct if there is one.
 * @returns {Resolved | undefined}
 */
export function resolveMigrationUrl() {
  return resolveFrom(DIRECT_CANDIDATES) ?? resolveFrom(POOLED_CANDIDATES);
}

/**
 * Every name that was looked for, for an error message worth reading.
 * @returns {string[]}
 */
export function allCandidateNames() {
  return [...DIRECT_CANDIDATES, ...POOLED_CANDIDATES];
}

/**
 * Host and database only — safe to print in a build log.
 * @param {string} url
 * @returns {string}
 */
export function describe(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "unparseable connection string";
  }
}
