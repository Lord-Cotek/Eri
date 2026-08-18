/**
 * Environment validation, run at boot.
 *
 * This module throws on import when required configuration is missing. It is
 * imported from `instrumentation.ts` (server start) and from the root layout
 * (every render, and every prerender during `next build`), so a misconfigured
 * deployment fails at build time rather than serving a broken page.
 *
 * The crisis resources are required in **every** environment and at every
 * phase — development, build and runtime — and have no default. The rest are
 * required when a production server starts.
 *
 * There used to be a fallback to a UK number. That was worse than no fallback:
 * a deployment in another country would have silently told a man in trouble to
 * call a line that cannot help him, and nothing would have looked wrong. If
 * Ẹ̀rí cannot name a real person to call, it does not run.
 */

type Requirement = { key: string; why: string };

const REQUIRED_ALWAYS: Requirement[] = [
  {
    key: "CRISIS_LINE_NAME",
    why: "the crisis line surfaced when Ẹlẹ́rìí stops the flow. Set it for the region you serve.",
  },
  {
    key: "CRISIS_LINE_CONTACT",
    why: "how to reach that crisis line — a number a man can actually dial tonight.",
  },
];

const REQUIRED_IN_PRODUCTION: Requirement[] = [
  { key: "DATABASE_URL", why: "the pooled Neon connection string." },
  { key: "NEXTAUTH_SECRET", why: "signs session cookies. Generate with `openssl rand -base64 32`." },
  { key: "NEXTAUTH_URL", why: "the canonical origin, e.g. https://eri.cotek.app." },
  { key: "NEXT_PUBLIC_SITE_URL", why: "used for invite links and OG metadata." },
  { key: "CRON_SECRET", why: "authorises the sweep. Without it the sweep endpoint is closed and windows never lapse." },
  { key: "EMAIL_SERVER", why: "SMTP for sign-in links and notifications. Nobody can sign in without it." },
  { key: "EMAIL_FROM", why: "the address notifications are sent from." },
];

function missing(requirements: Requirement[]): Requirement[] {
  return requirements.filter(({ key }) => !process.env[key]?.trim());
}

/**
 * `next build` runs with NODE_ENV=production, but a build machine legitimately
 * has no SMTP server and no database. The crisis resources are still required
 * there — they are a property of the deployment, not of the runtime — while the
 * rest are checked when the server actually starts serving.
 */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function assertEnv(): void {
  const gaps = [
    ...missing(REQUIRED_ALWAYS),
    ...(process.env.NODE_ENV === "production" && !isBuildPhase() ? missing(REQUIRED_IN_PRODUCTION) : []),
  ];

  if (gaps.length === 0) return;

  throw new Error(
    [
      "",
      "Ẹ̀rí will not start. Required configuration is missing:",
      "",
      ...gaps.map(({ key, why }) => `  ${key}  —  ${why}`),
      "",
      "See apps/web/.env.example. In production, set these on the deployment.",
      "",
    ].join("\n"),
  );
}

assertEnv();

/**
 * The crisis resources. Guaranteed present — `assertEnv` has already run.
 *
 * Read through this rather than `process.env` so there is exactly one place
 * that could ever grow a default, and it does not.
 */
export function crisisResources(): { name: string; contact: string } {
  return {
    name: process.env.CRISIS_LINE_NAME as string,
    contact: process.env.CRISIS_LINE_CONTACT as string,
  };
}
