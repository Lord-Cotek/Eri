/**
 * Sentinel request authentication.
 *
 * Every request from a device arrives as a signed envelope. This module is the
 * only place that decides whether one is genuine, so all four endpoints get the
 * same answer to the same question.
 *
 * The checks, in order:
 *
 *   1. The body parses as JSON and matches its zod schema. Anything else is
 *      MALFORMED — we never reason about a shape we have not validated.
 *   2. `sentAt` is within ±5 minutes of server time. CLOCK_SKEW otherwise.
 *   3. The nonce has not been seen. REPLAY otherwise. Recording it is the same
 *      write that claims it, so two concurrent replays cannot both win.
 *   4. The signature verifies against the device's stored public key.
 *   5. The device is not retired and its covenant is ACTIVE.
 *
 * Order matters for what an attacker learns: signature verification happens
 * before any covenant lookup, and every auth failure returns the same shape.
 */

import "server-only";

import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { JsonObject } from "@eri/protocol";
import {
  HEADER_SIGNATURE,
  MAX_CLOCK_SKEW_SECONDS,
  PROTOCOL_ERROR_STATUS,
  type ProtocolErrorCode,
} from "@eri/protocol";
import { checkFreshness, verifyEnvelope } from "@eri/protocol/signing";

import { prisma } from "@/lib/prisma";

export function protocolError(code: ProtocolErrorCode, message: string): NextResponse {
  return NextResponse.json({ error: code, message }, { status: PROTOCOL_ERROR_STATUS[code] });
}

export type Verified<T> = {
  envelope: T;
  signature: string;
  /** The raw parsed body, used as the signed object. */
  raw: JsonObject;
};

export type VerifyOutcome<T> = { ok: true; value: Verified<T> } | { ok: false; response: NextResponse };

/**
 * Parse and freshness-check a signed envelope, without yet verifying the
 * signature — the caller supplies the public key, which for `/register` comes
 * out of the envelope itself and for everything else comes from the database.
 */
export async function readEnvelope<T>(
  request: NextRequest,
  schema: z.ZodType<T>,
): Promise<VerifyOutcome<T>> {
  const signature = request.headers.get(HEADER_SIGNATURE);
  if (!signature) {
    return { ok: false, response: protocolError("BAD_SIGNATURE", "Missing signature header.") };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: protocolError("MALFORMED", "Body is not JSON.") };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: protocolError("MALFORMED", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")),
    };
  }

  const envelope = parsed.data as T & { sentAt: string };
  const fresh = checkFreshness(new Date(envelope.sentAt), new Date(), MAX_CLOCK_SKEW_SECONDS);
  if (!fresh.ok) {
    return { ok: false, response: protocolError("CLOCK_SKEW", "Timestamp is outside the accepted window.") };
  }

  return { ok: true, value: { envelope: parsed.data, signature, raw: raw as JsonObject } };
}

/**
 * Claim a nonce.
 *
 * The insert *is* the claim: a unique-constraint violation means somebody
 * already used it, which is exactly what a replay looks like. Doing it as one
 * write rather than a read-then-write closes the race between two copies of the
 * same captured request.
 */
export async function claimNonce(nonce: string, deviceId?: string): Promise<boolean> {
  try {
    await prisma.seenNonce.create({ data: { nonce, deviceId: deviceId ?? null } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
    throw error;
  }
}

export type AuthedDevice = {
  id: string;
  subjectId: string;
  label: string;
  status: "ACTIVE" | "SILENT" | "RETIRED";
  covenantId: string;
  graceWindowMinutes: number;
  covenantActive: boolean;
};

/**
 * Verify a device-addressed envelope end to end.
 *
 * Returns the device *and* its covenant, because every caller needs both and
 * looking them up separately is how a covenant check gets skipped.
 */
export async function authenticateDevice(input: {
  deviceId: string;
  nonce: string;
  signature: string;
  raw: JsonObject;
  /** Heartbeats are accepted from an ended covenant so the sentinel learns to stop. */
  allowInactiveCovenant?: boolean;
}): Promise<{ ok: true; device: AuthedDevice } | { ok: false; response: NextResponse }> {
  const device = await prisma.device.findUnique({
    where: { id: input.deviceId },
    select: { id: true, subjectId: true, covenantId: true, label: true, status: true, publicKey: true },
  });

  // A wrong device id and a wrong signature return the same thing, so an
  // attacker cannot enumerate device ids by comparing error codes.
  if (!device || !verifyEnvelope(input.raw, input.signature, device.publicKey)) {
    return { ok: false, response: protocolError("BAD_SIGNATURE", "Signature did not verify.") };
  }

  if (!(await claimNonce(input.nonce, device.id))) {
    return { ok: false, response: protocolError("REPLAY", "That nonce has already been used.") };
  }

  if (device.status === "RETIRED") {
    return { ok: false, response: protocolError("DEVICE_RETIRED", "This device has been retired.") };
  }

  // The covenant this device was bound to at registration — looked up by id,
  // never re-derived from `subjectId`. A man who ends one covenant and starts
  // another must not have his old device adopted by the new one; its events
  // would reach an ally who never agreed to receive them.
  const covenant = await prisma.covenant.findUnique({
    where: { id: device.covenantId },
    select: { id: true, status: true, graceWindowMinutes: true },
  });

  if (!covenant || covenant.status === "PENDING" || covenant.status === "DECLINED") {
    return { ok: false, response: protocolError("COVENANT_INACTIVE", "No covenant for this device.") };
  }

  const covenantActive = covenant.status === "ACTIVE";
  if (!covenantActive && !input.allowInactiveCovenant) {
    return { ok: false, response: protocolError("COVENANT_INACTIVE", "This covenant has ended.") };
  }

  return {
    ok: true,
    device: {
      id: device.id,
      subjectId: device.subjectId,
      label: device.label,
      status: device.status,
      covenantId: covenant.id,
      graceWindowMinutes: covenant.graceWindowMinutes,
      covenantActive,
    },
  };
}
