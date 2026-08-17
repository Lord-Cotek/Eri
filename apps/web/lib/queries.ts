/**
 * Reads for the surfaces.
 *
 * The important one is `allyTimeline`. It filters on resolved states in the
 * query itself rather than fetching everything and filtering in the component,
 * so a pending event is never loaded into a page the ally can see — not into
 * the props, not into the HTML, not into a React payload he could open the
 * devtools on.
 */

import "server-only";

import type { AntecedentKind, EventCategory, EventState } from "@prisma/client";
import { RESOLVED_STATES, SILENCE_ALERT_AFTER_MINUTES } from "@eri/protocol";

import { prisma } from "@/lib/prisma";
import { addDays, dayKey, startOfDay, weekStart } from "@/lib/time";
import type { WeekRhythm } from "@/lib/elerii";

/* ------------------------------------------------------------------ */
/* The subject's surface                                               */
/* ------------------------------------------------------------------ */

/** The open event, if there is one. Only ever visible to the subject. */
export async function pendingEvent(covenantId: string) {
  return prisma.event.findFirst({
    where: { covenantId, state: "PENDING" },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      category: true,
      occurredAt: true,
      windowExpiresAt: true,
      confidence: true,
    },
  });
}

/**
 * The event he just settled, if he settled one a moment ago.
 *
 * Once an event resolves it stops being pending, so the card he was looking at
 * disappears from his page. Without this he would be left staring at a screen
 * with no sign that anything happened — and the one thing he needs to know is
 * that his ally was told he came forward. Derived from the server so it
 * survives a reload.
 */
export async function justResolvedEvent(covenantId: string, withinMinutes = 15) {
  const since = new Date(Date.now() - withinMinutes * 60_000);
  return prisma.event.findFirst({
    where: { covenantId, resolvedAt: { gte: since } },
    orderBy: { resolvedAt: "desc" },
    select: { id: true, state: true, category: true, occurredAt: true, resolvedAt: true, disclosureNote: true },
  });
}

export type RhythmPoint = {
  day: string;
  label: string;
  events: number;
  disclosed: number;
  lapsed: number;
};

/**
 * Disclosure honesty over time.
 *
 * Note what this does not compute: a "clean" count. The headline is days of
 * honest disclosure, and a day with three owned events is a better day than a
 * day with one lapsed one.
 */
export async function disclosureRhythm(covenantId: string, days = 30): Promise<RhythmPoint[]> {
  const since = startOfDay(addDays(new Date(), -(days - 1)));

  const events = await prisma.event.findMany({
    where: { covenantId, occurredAt: { gte: since } },
    select: { occurredAt: true, state: true },
    orderBy: { occurredAt: "asc" },
  });

  const buckets = new Map<string, RhythmPoint>();
  for (let i = 0; i < days; i++) {
    const date = addDays(since, i);
    const key = dayKey(date);
    buckets.set(key, {
      day: key,
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      events: 0,
      disclosed: 0,
      lapsed: 0,
    });
  }

  for (const event of events) {
    const bucket = buckets.get(dayKey(event.occurredAt));
    if (!bucket) continue;
    bucket.events += 1;
    if (event.state === "DISCLOSED") bucket.disclosed += 1;
    if (event.state === "LAPSED") bucket.lapsed += 1;
  }

  return [...buckets.values()];
}

/**
 * Consecutive days on which nothing was left unowned.
 *
 * A day with no events counts — silence is not dishonesty. A day with a lapsed
 * window breaks it. This is a *disclosure* streak, and it is never rendered as
 * a flame, a badge, or a number to protect.
 */
export async function disclosureStreakDays(covenantId: string, lookback = 180): Promise<number> {
  const since = startOfDay(addDays(new Date(), -lookback));
  const events = await prisma.event.findMany({
    where: { covenantId, occurredAt: { gte: since } },
    select: { occurredAt: true, state: true },
  });

  const lapsedDays = new Set(
    events.filter((e) => e.state === "LAPSED").map((e) => dayKey(e.occurredAt)),
  );

  let streak = 0;
  for (let i = 0; i < lookback; i++) {
    const day = dayKey(addDays(new Date(), -i));
    if (lapsedDays.has(day)) break;
    streak += 1;
  }
  return streak;
}

/** Recent antecedent signals for this man's devices. His alone. */
export async function recentAntecedents(subjectId: string, hours = 48) {
  const since = new Date(Date.now() - hours * 3_600_000);
  return prisma.antecedent.findMany({
    where: { device: { subjectId }, occurredAt: { gte: since } },
    orderBy: { occurredAt: "desc" },
    select: { id: true, kind: true, occurredAt: true },
    take: 50,
  });
}

export async function antecedentSummary(subjectId: string, days = 14) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.antecedent.findMany({
    where: { device: { subjectId }, occurredAt: { gte: since } },
    select: { kind: true, occurredAt: true },
  });

  const counts: Partial<Record<AntecedentKind, number>> = {};
  const hourCounts = new Map<number, number>();
  for (const row of rows) {
    counts[row.kind] = (counts[row.kind] ?? 0) + 1;
    const hour = row.occurredAt.getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  const hours = [...hourCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => hour);

  return { counts, hours, days };
}

/* ------------------------------------------------------------------ */
/* The ally's surface                                                  */
/* ------------------------------------------------------------------ */

export type TimelineEntry = {
  id: string;
  category: EventCategory;
  occurredAt: Date;
  resolvedAt: Date | null;
  state: Exclude<EventState, "PENDING">;
  disclosureNote: string | null;
  acknowledged: boolean;
};

/**
 * The ally's timeline. Resolved events only, enforced in the query.
 *
 * There is no code path anywhere that hands an ally a PENDING event. This is
 * the one that would be tempting to loosen; do not.
 */
export async function allyTimeline(covenantId: string, allyId: string, take = 40): Promise<TimelineEntry[]> {
  const events = await prisma.event.findMany({
    where: { covenantId, state: { in: [...RESOLVED_STATES] } },
    orderBy: { occurredAt: "desc" },
    take,
    select: {
      id: true,
      category: true,
      occurredAt: true,
      resolvedAt: true,
      state: true,
      disclosureNote: true,
      allyAcks: { where: { allyId }, select: { id: true }, take: 1 },
    },
  });

  return events.map((event) => ({
    id: event.id,
    category: event.category,
    occurredAt: event.occurredAt,
    resolvedAt: event.resolvedAt,
    state: event.state as Exclude<EventState, "PENDING">,
    disclosureNote: event.disclosureNote,
    acknowledged: event.allyAcks.length > 0,
  }));
}

export async function latestDigest(covenantId: string) {
  return prisma.digest.findFirst({
    where: { covenantId },
    orderBy: { weekStart: "desc" },
  });
}

/* ------------------------------------------------------------------ */
/* Devices and silence                                                 */
/* ------------------------------------------------------------------ */

export async function devicesFor(subjectId: string) {
  return prisma.device.findMany({
    where: { subjectId, status: { not: "RETIRED" } },
    orderBy: { registeredAt: "asc" },
    select: {
      id: true,
      label: true,
      platform: true,
      status: true,
      lastHeartbeatAt: true,
      registeredAt: true,
      sentinelVersion: true,
      classifierVersion: true,
      silences: {
        where: { endedAt: null },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, severity: true, startedAt: true },
      },
    },
  });
}

/** Open silences across a subject's devices — what the ally is told about. */
export async function openSilences(subjectId: string) {
  return prisma.silence.findMany({
    where: { device: { subjectId }, endedAt: null },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      severity: true,
      startedAt: true,
      allyNotifiedAt: true,
      device: { select: { label: true } },
    },
  });
}

/* ------------------------------------------------------------------ */
/* The week, as Ẹlẹ́rìí is given it                                     */
/* ------------------------------------------------------------------ */

/**
 * Build a week's rhythm.
 *
 * Everything in the returned object is a count, a timestamp or an hour number.
 * That is deliberate: this is the *entire* input Ẹlẹ́rìí is ever given, so the
 * type is the privacy fence.
 */
export async function weekRhythm(covenantId: string, subjectId: string, week?: Date): Promise<WeekRhythm> {
  const start = week ?? weekStart(new Date());
  const end = addDays(start, 7);

  const events = await prisma.event.findMany({
    where: { covenantId, occurredAt: { gte: start, lt: end } },
    select: { occurredAt: true, state: true },
  });

  const silences = await prisma.silence.findMany({
    where: { device: { subjectId }, startedAt: { gte: start, lt: end } },
    select: { startedAt: true, endedAt: true },
  });

  const silenceMs = silences.reduce((total, silence) => {
    const finish = silence.endedAt ?? new Date();
    return total + Math.max(0, finish.getTime() - silence.startedAt.getTime());
  }, 0);

  const hours = [...new Set(events.map((e) => e.occurredAt.getHours()))].sort((a, b) => a - b);

  return {
    weekStart: start,
    totalEvents: events.length,
    disclosedByHim: events.filter((e) => e.state === "DISCLOSED").length,
    lapsed: events.filter((e) => e.state === "LAPSED").length,
    contested: events.filter((e) => e.state === "CONTESTED").length,
    hours,
    disclosureStreakDays: await disclosureStreakDays(covenantId),
    silenceHours: Math.round(silenceMs / 3_600_000),
  };
}

/** Devices that have gone quiet past the ALERT threshold. */
export async function devicesInAlert(subjectId: string) {
  const cutoff = new Date(Date.now() - SILENCE_ALERT_AFTER_MINUTES * 60_000);
  return prisma.device.findMany({
    where: {
      subjectId,
      status: { not: "RETIRED" },
      OR: [{ lastHeartbeatAt: { lt: cutoff } }, { lastHeartbeatAt: null, registeredAt: { lt: cutoff } }],
    },
    select: { id: true, label: true, lastHeartbeatAt: true, registeredAt: true },
  });
}

export async function unreadNotifications(userId: string, take = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, kind: true, body: true, createdAt: true, readAt: true },
  });
}
