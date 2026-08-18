/**
 * POST /api/v1/sentinel/register
 *
 * One-time. Exchanges a short-lived pairing code for a Device record.
 *
 * This envelope is self-signed: the signature is verified against the public
 * key carried in the body, which proves the caller holds the matching private
 * half. That is all registration needs to prove — the *authorisation* comes
 * from the pairing code, which was shown once in the subject's own browser.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { HEARTBEAT_INTERVAL_MINUTES, registerRequest } from "@eri/protocol";
import { verifyEnvelope } from "@eri/protocol/signing";

import { prisma } from "@/lib/prisma";
import { claimNonce, protocolError, readEnvelope } from "@/lib/sentinel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const read = await readEnvelope(request, registerRequest);
  if (!read.ok) return read.response;

  const { envelope, signature, raw } = read.value;

  if (!verifyEnvelope(raw, signature, envelope.publicKey)) {
    return protocolError("BAD_SIGNATURE", "Signature did not verify against the presented key.");
  }

  if (!(await claimNonce(envelope.nonce))) {
    return protocolError("REPLAY", "That nonce has already been used.");
  }

  const pairing = await prisma.pairingCode.findUnique({
    where: { code: envelope.pairingCode },
    include: {
      covenant: {
        select: { id: true, subjectId: true, status: true, graceWindowMinutes: true },
      },
    },
  });

  // Unknown, expired and already-used codes are one error, so a caller cannot
  // learn which codes exist by trying them.
  if (!pairing || pairing.usedAt || pairing.expiresAt < new Date()) {
    return protocolError("BAD_PAIRING_CODE", "That pairing code is not usable.");
  }

  if (pairing.covenant.status !== "ACTIVE") {
    return protocolError("COVENANT_INACTIVE", "That covenant is not active.");
  }

  const device = await prisma.$transaction(async (tx) => {
    // Guarded on `usedAt: null` so two devices racing the same code cannot both
    // register — a pairing code is single-use and this is where that is true.
    const claimed = await tx.pairingCode.updateMany({
      where: { id: pairing.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return null;

    const created = await tx.device.create({
      data: {
        subjectId: pairing.covenant.subjectId,
        // Bound here, once, to the covenant that minted this code — and never
        // re-derived afterwards. See the Device model comment.
        covenantId: pairing.covenant.id,
        platform: envelope.platform,
        label: envelope.label,
        publicKey: envelope.publicKey,
        sentinelVersion: envelope.sentinelVersion,
        classifierVersion: envelope.classifierVersion,
        status: "ACTIVE",
        lastHeartbeatAt: new Date(),
      },
    });

    await tx.pairingCode.update({ where: { id: pairing.id }, data: { usedByDeviceId: created.id } });
    return created;
  });

  if (!device) return protocolError("BAD_PAIRING_CODE", "That pairing code is not usable.");

  return NextResponse.json({
    deviceId: device.id,
    covenantId: pairing.covenant.id,
    graceWindowMinutes: pairing.covenant.graceWindowMinutes,
    heartbeatIntervalMinutes: HEARTBEAT_INTERVAL_MINUTES,
  });
}
