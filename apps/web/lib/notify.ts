/**
 * Notification delivery.
 *
 * Two channels: an in-app record (always) and email (when SMTP is configured).
 * Push is a phase-2 concern and belongs with the native sentinels; the shape
 * here is already the shape a push payload would take.
 *
 * PRIVACY INVARIANT — read the templates below. Every one of them is a fixed
 * string interpolating a category *label*, a clock time, and a state. None of
 * them accepts content, and none of them can, because there is no content in
 * the system to pass. The one variable string that ever reaches an ally is the
 * subject's own disclosure note, which he wrote and chose to send.
 *
 * The other rule this module enforces: **the ally is told nothing during the
 * grace window.** Not that an event is pending, not a count, not a hint.
 * `notifyAllyOfResolution` refuses to run on a PENDING event.
 */

import "server-only";

import nodemailer from "nodemailer";
import type { NotificationKind, Prisma } from "@prisma/client";
import { ALLY_OUTCOME_COPY, EVENT_CATEGORY_LABELS, type EventCategory, type EventState } from "@eri/protocol";

import { prisma } from "@/lib/prisma";
import { clockTime, humanDuration, longDate } from "@/lib/time";

type Db = Prisma.TransactionClient | typeof prisma;

export type NotifyInput = {
  userId: string;
  kind: NotificationKind;
  body: string;
  eventId?: string;
  covenantId?: string;
  digestId?: string;
  /** Subject line if this goes out by email. Defaults to a neutral one. */
  subject?: string;
  db?: Db;
};

/* ------------------------------------------------------------------ */
/* Delivery                                                            */
/* ------------------------------------------------------------------ */

let transport: nodemailer.Transporter | null = null;

function mailer(): nodemailer.Transporter | null {
  const server = process.env.EMAIL_SERVER;
  if (!server) return null;
  transport ??= nodemailer.createTransport(server);
  return transport;
}

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const transporter = mailer();
  if (!transporter) {
    // In development the covenant should still be demonstrable end to end, so
    // the would-be email is logged rather than silently dropped.
    console.info(`[notify] (no SMTP configured) → ${to}: ${subject}\n${body}`);
    return false;
  }
  try {
    await transporter.sendMail({
      to,
      from: process.env.EMAIL_FROM ?? "no-reply@cotek.live",
      subject,
      text: body,
    });
    return true;
  } catch (error) {
    console.error("[notify] email failed", error);
    return false;
  }
}

/**
 * Record a notification and try to deliver it.
 *
 * The in-app record is written first and is the source of truth — email is
 * best-effort. A man is never left without the record because a mail server
 * was down.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const db = input.db ?? prisma;

  const record = await db.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      body: input.body,
      eventId: input.eventId ?? null,
      covenantId: input.covenantId ?? null,
      digestId: input.digestId ?? null,
    },
  });

  const user = await db.user.findUnique({ where: { id: input.userId }, select: { email: true } });
  if (!user?.email) return;

  const sent = await sendEmail(user.email, input.subject ?? "Ẹ̀rí", input.body);
  if (sent) {
    await db.notification.update({ where: { id: record.id }, data: { emailedAt: new Date() } });
  }
}

/* ------------------------------------------------------------------ */
/* Templates — the complete set of things Ẹ̀rí ever says                */
/* ------------------------------------------------------------------ */

export const COPY = {
  /** To the SUBJECT, and nobody else, the moment an event lands. */
  eventPending(category: EventCategory, occurredAt: Date, windowMinutes: number): string {
    return [
      `Something was flagged at ${clockTime(occurredAt)}.`,
      "",
      "Do you want to tell him yourself?",
      "",
      `You have ${windowMinutes} minutes. Nothing has been sent to him.`,
    ].join("\n");
  },

  /** To the ALLY, only once the event has resolved. */
  eventResolved(state: Exclude<EventState, "PENDING">, category: EventCategory, occurredAt: Date): string {
    return [
      ALLY_OUTCOME_COPY[state],
      "",
      `${EVENT_CATEGORY_LABELS[category]} — ${clockTime(occurredAt)}, ${longDate(occurredAt)}.`,
    ].join("\n");
  },

  /** To the SUBJECT, before anything has happened. The intervention belongs here. */
  antecedentNudge(observation: string): string {
    return observation;
  },

  /** To the ALLY, when a device stops speaking. Silence is the loudest signal. */
  silenceAlert(deviceLabel: string, sinceMs: number): string {
    return [
      `${deviceLabel} has not reported in for ${humanDuration(sinceMs)}.`,
      "",
      "That may be a flat battery, a lost phone, or the app being gone.",
      "Ẹ̀rí cannot tell which. It can only tell you it went quiet.",
    ].join("\n");
  },

  covenantInvited(subjectName: string, url: string): string {
    return [
      `${subjectName} has asked you to be his ally.`,
      "",
      "He installed this on himself and he chose you. Read the terms before you sign — being an ally asks something of you.",
      "",
      url,
    ].join("\n");
  },

  covenantActivated(otherName: string): string {
    return `The covenant with ${otherName} is active.`;
  },

  /** Consent is revocable, but never silently. */
  covenantRevoked(subjectName: string): string {
    return [
      `${subjectName} has ended the covenant.`,
      "",
      "He is within his rights to do that at any time, and you are being told because he did.",
      "No further events will reach you.",
    ].join("\n");
  },

  covenantDeclined(allyName: string): string {
    return `${allyName} declined the covenant.`;
  },

  graceWindowChanged(subjectName: string, minutes: number): string {
    return `${subjectName} changed his grace window to ${minutes} minutes. You are told when it changes.`;
  },

  /** The whole of the ally's reply surface, sent back to the subject verbatim. */
  allyAck(allyName: string): string {
    return `${allyName}: "I saw it. I'm still here."`;
  },

  digestReady(): string {
    return "This week's digest is ready, with one question to bring him.";
  },
} as const;

/* ------------------------------------------------------------------ */
/* Guarded helpers                                                     */
/* ------------------------------------------------------------------ */

const KIND_FOR_STATE: Record<Exclude<EventState, "PENDING">, NotificationKind> = {
  DISCLOSED: "EVENT_DISCLOSED",
  CONTESTED: "EVENT_CONTESTED",
  LAPSED: "EVENT_LAPSED",
};

/**
 * Tell the ally an event resolved.
 *
 * This is the *only* path by which an event reaches an ally. It throws on a
 * PENDING event rather than returning quietly, so a future caller that gets the
 * ordering wrong fails loudly in development instead of leaking a pending
 * event into the ally's view.
 */
export async function notifyAllyOfResolution(input: {
  allyId: string | null;
  eventId: string;
  covenantId: string;
  state: EventState;
  category: EventCategory;
  occurredAt: Date;
  disclosureNote?: string | null;
  db?: Db;
}): Promise<void> {
  if (input.state === "PENDING") {
    throw new Error("notifyAllyOfResolution called on a PENDING event — the ally sees nothing during the window");
  }
  if (!input.allyId) return;

  const state = input.state as Exclude<EventState, "PENDING">;
  const body =
    input.state === "DISCLOSED" && input.disclosureNote
      ? `${COPY.eventResolved(state, input.category, input.occurredAt)}\n\nHe wrote:\n"${input.disclosureNote}"`
      : COPY.eventResolved(state, input.category, input.occurredAt);

  await notify({
    userId: input.allyId,
    kind: KIND_FOR_STATE[state],
    body,
    eventId: input.eventId,
    covenantId: input.covenantId,
    subject: "Ẹ̀rí — an event resolved",
    db: input.db,
  });
}
