/**
 * The sweep. Vercel Cron, every 10 minutes. See vercel.json.
 *
 * Four jobs:
 *   1. Lapse windows that ran out, and tell the allies.
 *   2. Open and escalate Silence records; tell the ally on ALERT.
 *   3. Generate last week's digests.
 *   4. Prune nonces that are older than any replay could still use.
 *
 * This is the only place in the system where an event resolves without a man
 * touching anything, and it is the reason the covenant does not depend on the
 * subject remembering to do the honest thing.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { MAX_CLOCK_SKEW_SECONDS } from "@eri/protocol";
import { safeEqual } from "@eri/protocol/signing";

import { generateDueDigests } from "@/lib/digest";
import { lapseExpiredEvents } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { sweepSilences } from "@/lib/silence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Without a configured secret the endpoint is closed rather than open. A
  // sweep that anybody can trigger is a way to force windows shut early.
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  return safeEqual(presented, secret);
}

async function pruneNonces(now: Date): Promise<number> {
  // Past the skew window a replayed request would be rejected on its timestamp
  // anyway, so the nonce no longer earns its row.
  const cutoff = new Date(now.getTime() - MAX_CLOCK_SKEW_SECONDS * 1000 * 2);
  const { count } = await prisma.seenNonce.deleteMany({ where: { seenAt: { lt: cutoff } } });
  return count;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "UNAUTHORISED" }, { status: 401 });
  }

  const now = new Date();

  const lapsed = await lapseExpiredEvents(now);
  const silence = await sweepSilences(now);
  const digests = await generateDueDigests(now);
  const noncesPruned = await pruneNonces(now);

  return NextResponse.json({
    sweptAt: now.toISOString(),
    lapsed,
    silence,
    digests,
    noncesPruned,
  });
}

/** Vercel Cron issues GET; POST is here for manual invocation with the same secret. */
export const POST = GET;
