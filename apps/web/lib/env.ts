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

import { resolveRuntimeUrl } from "@/lib/database-url.mjs";

type Requirement = { key: string; why: string };

const REQUIRED_ALWAYS: Requirement[] = [
  {
    key: "CRISIS_LINE_NAME",
    why: "the support line surfaced when Ẹlẹ́rìí stops the flow. Set it for the region you serve.",
  },
  {
    key: "CRISIS_LINE_CONTACT",
    why: "how to reach that support line.",
  },
  {
    key: "CRISIS_EMERGENCY_CONTACT",
    why:
      "a number that answers at three in the morning. Most national support lines keep office hours — " +
      "the UAE's 800 HOPE is 8am to 8pm — and this product's whole subject is what happens late at night.",
  },
];

const REQUIRED_IN_PRODUCTION: Requirement[] = [
  { key: "NEXTAUTH_SECRET", why: "signs session cookies. Generate with `openssl rand -base64 32`." },
  { key: "NEXTAUTH_URL", why: "the canonical origin, e.g. https://eri.cotek.app." },
  { key: "NEXT_PUBLIC_SITE_URL", why: "used for invite links and OG metadata." },
  { key: "CRON_SECRET", why: "authorises the sweep. Without it the sweep endpoint is closed and windows never lapse." },
  { key: "EMAIL_FROM", why: "the address notifications are sent from." },
];

/**
 * The database is required, but the name it arrives under varies — an
 * integration prefixes it with the store name, so `DATABASE_URL` may genuinely
 * be absent while `eri_DATABASE_URL` is present. `lib/database-url.mjs` knows
 * the whole list; here we only need to know whether one of them resolved.
 */
function databaseConfigured(): boolean {
  return Boolean(resolveRuntimeUrl());
}

/**
 * Mail needs one transport, not both. Resend over HTTPS is preferred on
 * serverless; SMTP is the fallback for anyone not using it.
 */
const EMAIL_TRANSPORTS: Requirement[] = [
  { key: "RESEND_API_KEY", why: "Resend API key — the preferred transport." },
  { key: "EMAIL_SERVER", why: "SMTP connection string, if you are not using Resend." },
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
  const inProduction = process.env.NODE_ENV === "production" && !isBuildPhase();

  const gaps = [
    ...missing(REQUIRED_ALWAYS),
    ...(inProduction ? missing(REQUIRED_IN_PRODUCTION) : []),
    ...(inProduction && !databaseConfigured()
      ? [
          {
            key: "DATABASE_URL",
            why: "the pooled Postgres connection string (or an integration-prefixed equivalent such as eri_DATABASE_URL).",
          },
        ]
      : []),
    // One transport is enough; neither is a gap.
    ...(inProduction && missing(EMAIL_TRANSPORTS).length === EMAIL_TRANSPORTS.length
      ? [
          {
            key: "RESEND_API_KEY or EMAIL_SERVER",
            why: "one mail transport. Sign-in is a magic link, so nobody can sign in without one.",
          },
        ]
      : []),
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
 * Treat an empty or whitespace-only variable as unset.
 *
 * `??` does not: a Vercel variable added but left blank arrives as `""`, which
 * is not nullish, so `process.env.X ?? default` yields `""` and the default
 * never applies. That put an empty string into `new URL()` — which throws, and
 * takes the whole site down — and into the Anthropic model name, which failed
 * silently into the fallback copy. Read configuration through this.
 */
export function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The canonical origin. One definition, because invite links, OG metadata,
 * robots and the sitemap must all agree — an invitation built against the wrong
 * origin is an invitation a man cannot accept.
 */
export function siteUrl(): string {
  // The literal `process.env.NEXT_PUBLIC_SITE_URL` reference is deliberate:
  // Next inlines NEXT_PUBLIC_* only where it appears literally.
  return blank(process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000";
}

export type CrisisResources = {
  /** The support line: someone to talk to. */
  name: string;
  contact: string;
  /** When it answers, if it is not always. Shown so nobody dials a closed line. */
  hours?: string;
  /** A number that answers at any hour. Required, because 01:14 is the point. */
  emergency: string;
};

/**
 * The crisis resources. Guaranteed present — `assertEnv` has already run.
 *
 * Read through this rather than `process.env` so there is exactly one place
 * that could ever grow a default, and it does not.
 *
 * Two numbers, not one. A counselling line is the better call when it is open,
 * and most of them are not open at the hour Ẹ̀rí exists to be useful at. Showing
 * only the daytime number would be a quiet way of offering nothing.
 */
export function crisisResources(): CrisisResources {
  return {
    name: process.env.CRISIS_LINE_NAME as string,
    contact: process.env.CRISIS_LINE_CONTACT as string,
    hours: blank(process.env.CRISIS_LINE_HOURS),
    emergency: process.env.CRISIS_EMERGENCY_CONTACT as string,
  };
}
