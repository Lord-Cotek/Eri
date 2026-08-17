/**
 * Weekly digests.
 *
 * The digest is the ally's rhythm. Its top line is one question to ask him this
 * week, because a list of events is a report and allies stop reading reports.
 *
 * Ẹlẹ́rìí writes the question from counts and timings. The summary beneath it is
 * written without a model, from the same counts — facts do not need a language
 * model and should not wait on one.
 */

import "server-only";

import type { Digest } from "@prisma/client";

import { plainWeekSummary, weeklyQuestion } from "@/lib/elerii";
import { COPY, notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { weekRhythm } from "@/lib/queries";
import { addDays, weekStart } from "@/lib/time";

/**
 * Generate the digest for a covenant's week, if it does not exist yet.
 *
 * Keyed on `(covenantId, weekStart)` with a unique constraint, so two
 * overlapping sweeps produce one digest rather than two.
 */
export async function generateDigest(input: {
  covenantId: string;
  subjectId: string;
  allyId: string | null;
  week: Date;
}): Promise<Digest | null> {
  const existing = await prisma.digest.findUnique({
    where: { covenantId_weekStart: { covenantId: input.covenantId, weekStart: input.week } },
  });
  if (existing) return null;

  const rhythm = await weekRhythm(input.covenantId, input.subjectId, input.week);
  const question = await weeklyQuestion(rhythm);

  try {
    const digest = await prisma.digest.create({
      data: {
        covenantId: input.covenantId,
        weekStart: input.week,
        questionText: question.text,
        summaryText: plainWeekSummary(rhythm),
      },
    });

    if (input.allyId) {
      await notify({
        userId: input.allyId,
        kind: "DIGEST_READY",
        body: COPY.digestReady(),
        covenantId: input.covenantId,
        digestId: digest.id,
        subject: "Ẹ̀rí — this week",
      });
    }

    return digest;
  } catch {
    // Lost the race with a concurrent sweep. One digest is the correct outcome.
    return null;
  }
}

/**
 * Generate last week's digest for every active covenant.
 *
 * "Last week" rather than "this week": a digest for a week still in progress
 * would be a partial account, and the ally would read it as the whole one.
 */
export async function generateDueDigests(now = new Date()): Promise<number> {
  const week = addDays(weekStart(now), -7);

  const covenants = await prisma.covenant.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, subjectId: true, allyId: true },
  });

  let generated = 0;
  for (const covenant of covenants) {
    const digest = await generateDigest({
      covenantId: covenant.id,
      subjectId: covenant.subjectId,
      allyId: covenant.allyId,
      week,
    });
    if (digest) generated += 1;
  }
  return generated;
}
