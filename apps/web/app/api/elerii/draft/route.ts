/**
 * POST /api/elerii/draft
 *
 * Ẹlẹ́rìí drafts a disclosure. The subject edits it and sends it himself — this
 * route returns text and does nothing else. It has no path to the ally, no
 * write to an Event, and no side effect at all.
 *
 * Callable only by the subject of the event, only while the window is open.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { msRemaining } from "@eri/protocol";

import { currentUserId } from "@/lib/auth";
import { displayName } from "@/lib/covenant";
import { draftDisclosure } from "@/lib/elerii";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  eventId: z.string().min(1),
  /** Anything he has already typed. Never a description of content. */
  startingWords: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "MALFORMED" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: parsed.data.eventId },
    include: {
      covenant: {
        select: { subjectId: true, ally: { select: { name: true, email: true } } },
      },
    },
  });

  if (!event || event.covenant.subjectId !== userId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (event.state !== "PENDING") {
    return NextResponse.json({ error: "ALREADY_RESOLVED" }, { status: 409 });
  }

  const result = await draftDisclosure({
    category: event.category,
    occurredAt: event.occurredAt,
    windowMinutesRemaining: Math.ceil(msRemaining(event.windowExpiresAt, new Date()) / 60_000),
    startingWords: parsed.data.startingWords,
    allyName: event.covenant.ally ? displayName(event.covenant.ally) : undefined,
  });

  return NextResponse.json({
    text: result.text,
    generated: result.generated,
    crisis: result.crisis ?? false,
  });
}
