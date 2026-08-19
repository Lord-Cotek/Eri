/**
 * POST /api/v1/sentinel/heartbeat
 *
 * Every 15 minutes. The most important endpoint in the system.
 *
 * Ẹ̀rí cannot stop a man deleting the app, so it does not pretend to. What it
 * can do is notice when a device stops speaking, and say so. Silence is the
 * loudest signal here, and this is where it is measured from.
 *
 * A heartbeat is accepted even when the covenant has ended, so the sentinel
 * learns that it should stop and uninstall itself rather than retrying forever.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { HEARTBEAT_INTERVAL_MINUTES, heartbeatRequest } from "@eri/protocol";

import { prisma } from "@/lib/prisma";
import { authenticateDevice, readEnvelope } from "@/lib/sentinel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const read = await readEnvelope(request, heartbeatRequest);
  if (!read.ok) return read.response;

  const { envelope, signature, raw } = read.value;

  const auth = await authenticateDevice({
    deviceId: envelope.deviceId,
    nonce: envelope.nonce,
    signature,
    raw,
    allowInactiveCovenant: true,
  });
  if (!auth.ok) return auth.response;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.device.update({
      where: { id: auth.device.id },
      data: {
        lastHeartbeatAt: now,
        status: "ACTIVE",
        sentinelVersion: envelope.sentinelVersion,
        classifierVersion: envelope.classifierVersion,
        ...(envelope.osVersion ? { osVersion: envelope.osVersion } : {}),
      },
    });

    // A device that has come back closes its own silence. The record of the
    // gap stays — it happened, and the ally was told about it.
    await tx.silence.updateMany({
      where: { deviceId: auth.device.id, endedAt: null },
      data: { endedAt: now },
    });
  });

  return NextResponse.json({
    ok: true,
    graceWindowMinutes: auth.device.graceWindowMinutes,
    heartbeatIntervalMinutes: HEARTBEAT_INTERVAL_MINUTES,
    covenantActive: auth.device.covenantActive,
  });
}
