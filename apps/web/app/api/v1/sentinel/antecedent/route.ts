/**
 * POST /api/v1/sentinel/antecedent
 *
 * A pattern signal: a late hour, a long idle unlock, rapid app switching, a
 * phone off the charger overnight. Circumstances, not content, and not events.
 *
 * These exist because the intervention belongs *before* the event. They drive
 * the pre-emptive nudge on the subject's own page. They are never shown to the
 * ally individually — only aggregate rhythm reaches him, and only in a digest.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { antecedentRequest } from "@eri/protocol";

import { prisma } from "@/lib/prisma";
import { authenticateDevice, readEnvelope } from "@/lib/sentinel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const read = await readEnvelope(request, antecedentRequest);
  if (!read.ok) return read.response;

  const { envelope, signature, raw } = read.value;

  const auth = await authenticateDevice({
    deviceId: envelope.deviceId,
    nonce: envelope.nonce,
    signature,
    raw,
  });
  if (!auth.ok) return auth.response;

  const antecedent = await prisma.antecedent.create({
    data: {
      deviceId: auth.device.id,
      occurredAt: new Date(envelope.occurredAt),
      kind: envelope.antecedent,
      nonce: envelope.nonce,
      signature,
    },
  });

  return NextResponse.json({ ok: true, antecedentId: antecedent.id });
}
