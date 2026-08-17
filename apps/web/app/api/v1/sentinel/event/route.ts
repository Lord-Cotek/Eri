/**
 * POST /api/v1/sentinel/event
 *
 * A sentinel reports a detection.
 *
 * Look at what this handler has access to and what it therefore cannot leak:
 * a category, a time, a confidence number and a classifier version. There is no
 * image in the request, no address, no page text. The classifier ran on the
 * device and the only thing that survived it is a label.
 *
 * The response tells the device when the subject's window closes. It is not an
 * acknowledgement to anybody else — nothing is sent to the ally here.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { eventRequest } from "@eri/protocol";

import { recordEvent } from "@/lib/events";
import { authenticateDevice, readEnvelope } from "@/lib/sentinel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const read = await readEnvelope(request, eventRequest);
  if (!read.ok) return read.response;

  const { envelope, signature, raw } = read.value;

  const auth = await authenticateDevice({
    deviceId: envelope.deviceId,
    nonce: envelope.nonce,
    signature,
    raw,
  });
  if (!auth.ok) return auth.response;

  const { id, windowExpiresAt } = await recordEvent({
    deviceId: auth.device.id,
    covenantId: auth.device.covenantId,
    subjectId: auth.device.subjectId,
    occurredAt: new Date(envelope.occurredAt),
    category: envelope.category,
    confidence: envelope.confidence,
    classifierVersion: envelope.classifierVersion,
    graceWindowMinutes: auth.device.graceWindowMinutes,
    nonce: envelope.nonce,
    signature,
  });

  return NextResponse.json({
    eventId: id,
    state: "PENDING",
    windowExpiresAt: windowExpiresAt.toISOString(),
  });
}
