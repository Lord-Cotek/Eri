/**
 * The event lifecycle, applied to the database.
 *
 * `packages/protocol/src/state-machine.ts` decides whether a transition is
 * legal; this module performs it. Keeping those apart means the rule ("a
 * disclosure after the window does not count") is stated once, in a file the
 * native clients also read.
 *
 * The ordering rule every function here obeys: **the ally is notified only
 * after the event has reached a resolved state, and never before.**
 */

import "server-only";

import type { EventState } from "@eri/protocol";
import { DISCLOSURE_NOTE_MAX_LENGTH, applyAction, windowExpiryFrom } from "@eri/protocol";
import type { EventCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { COPY, notify, notifyAllyOfResolution } from "@/lib/notify";

export type RecordEventInput = {
  deviceId: string;
  covenantId: string;
  subjectId: string;
  occurredAt: Date;
  category: EventCategory;
  confidence: number;
  classifierVersion: string;
  graceWindowMinutes: number;
  nonce: string;
  signature: string;
};

/**
 * Accept an event from a sentinel.
 *
 * The window runs from `receivedAt`, not `occurredAt`. A device that was
 * offline for six hours must not hand its owner an already-expired window — he
 * would be reported for failing to answer a question nobody had asked him yet.
 */
export async function recordEvent(input: RecordEventInput): Promise<{ id: string; windowExpiresAt: Date }> {
  const receivedAt = new Date();
  const windowExpiresAt = windowExpiryFrom(receivedAt, input.graceWindowMinutes);

  const event = await prisma.event.create({
    data: {
      deviceId: input.deviceId,
      covenantId: input.covenantId,
      occurredAt: input.occurredAt,
      receivedAt,
      category: input.category,
      confidence: input.confidence,
      classifierVersion: input.classifierVersion,
      state: "PENDING",
      windowExpiresAt,
      nonce: input.nonce,
      signature: input.signature,
    },
  });

  // The subject, and nobody else. This is the whole inversion.
  await notify({
    userId: input.subjectId,
    kind: "EVENT_PENDING",
    body: COPY.eventPending(input.category, input.occurredAt, input.graceWindowMinutes),
    eventId: event.id,
    covenantId: input.covenantId,
    subject: "Ẹ̀rí — do you want to tell him yourself?",
  });

  return { id: event.id, windowExpiresAt };
}

export type ResolveOutcome =
  | { ok: true; state: EventState }
  | { ok: false; reason: "NOT_FOUND" | "NOT_YOURS" | "ALREADY_RESOLVED" | "WINDOW_EXPIRED" | "ILLEGAL" };

/**
 * The subject speaks first, or contests.
 *
 * `note` is his own words and the only free text that ever reaches the ally.
 * Contesting does not take an event out of the record — CONTESTED is reported,
 * labelled as contested. There is no escape hatch.
 */
export async function resolveBySubject(input: {
  eventId: string;
  subjectId: string;
  action: "DISCLOSE" | "CONTEST";
  note?: string;
}): Promise<ResolveOutcome> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: { covenant: { select: { id: true, subjectId: true, allyId: true } } },
  });

  if (!event) return { ok: false, reason: "NOT_FOUND" };
  if (event.covenant.subjectId !== input.subjectId) return { ok: false, reason: "NOT_YOURS" };

  const now = new Date();
  const transition = applyAction({
    state: event.state,
    action: input.action,
    windowExpiresAt: event.windowExpiresAt,
    now,
  });

  if (!transition.ok) {
    if (transition.reason === "ALREADY_RESOLVED") return { ok: false, reason: "ALREADY_RESOLVED" };
    if (transition.reason === "WINDOW_EXPIRED") return { ok: false, reason: "WINDOW_EXPIRED" };
    return { ok: false, reason: "ILLEGAL" };
  }

  const note = input.note?.trim().slice(0, DISCLOSURE_NOTE_MAX_LENGTH) || null;

  // Guarded on `state: "PENDING"` so two submissions cannot both resolve it.
  const updated = await prisma.event.updateMany({
    where: { id: event.id, state: "PENDING" },
    data: { state: transition.state, resolvedAt: now, disclosureNote: note },
  });
  if (updated.count === 0) return { ok: false, reason: "ALREADY_RESOLVED" };

  await notifyAllyOfResolution({
    allyId: event.covenant.allyId,
    eventId: event.id,
    covenantId: event.covenantId,
    state: transition.state,
    category: event.category,
    occurredAt: event.occurredAt,
    disclosureNote: note,
  });

  return { ok: true, state: transition.state };
}

/**
 * Lapse every window that has run out. Called by the sweep job.
 *
 * Each event is claimed with a guarded update before its ally is notified, so
 * two overlapping sweeps cannot report the same lapse twice.
 */
export async function lapseExpiredEvents(now = new Date()): Promise<number> {
  const expired = await prisma.event.findMany({
    where: { state: "PENDING", windowExpiresAt: { lte: now } },
    include: { covenant: { select: { id: true, allyId: true } } },
    take: 200,
  });

  let lapsed = 0;

  for (const event of expired) {
    const transition = applyAction({
      state: event.state,
      action: "LAPSE",
      windowExpiresAt: event.windowExpiresAt,
      now,
    });
    if (!transition.ok) continue;

    const claimed = await prisma.event.updateMany({
      where: { id: event.id, state: "PENDING" },
      data: { state: "LAPSED", resolvedAt: now },
    });
    if (claimed.count === 0) continue;

    await notifyAllyOfResolution({
      allyId: event.covenant.allyId,
      eventId: event.id,
      covenantId: event.covenantId,
      state: "LAPSED",
      category: event.category,
      occurredAt: event.occurredAt,
    });

    lapsed += 1;
  }

  return lapsed;
}
