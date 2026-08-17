/**
 * Ẹlẹ́rìí — the three jobs.
 *
 * Server-only. Every function here takes counts, categories and timings. None
 * of them takes content, because none exists to take. Read the input types as
 * the enforcement: there is no field to put a URL in.
 *
 * Every job has a plain fallback. If the API key is missing, the model errors,
 * or the crisis tripwire fires, the covenant carries on — Ẹlẹ́rìí is an
 * assistant to it, never a dependency of it.
 */

import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import {
  ANTECEDENT_KIND_LABELS,
  EVENT_CATEGORY_LABELS,
  type AntecedentKind,
  type EventCategory,
  type EventState,
} from "@eri/protocol";

import { DRAFTING_MODEL, ROUTINE_MODEL, anthropic, isEleriiConfigured } from "@/lib/anthropic";
import { clockTime, longDate } from "@/lib/time";
import { checkForCrisis } from "./safety";
import { systemPrompt, type EleriiTask } from "./system-prompt";

export { crisisResources, crisisResponse } from "./safety";
export { COTEK_DOCTRINE_BLOCK, systemPrompt } from "./system-prompt";

export type EleriiResult = {
  text: string;
  /** True when this came from the model; false when it is the plain fallback. */
  generated: boolean;
  /** Set when the crisis tripwire fired. The caller must surface people, not text. */
  crisis?: boolean;
};

async function ask(task: EleriiTask, model: string, userContent: string, maxTokens: number): Promise<string | null> {
  if (!isEleriiConfigured()) return null;
  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt(task),
      messages: [{ role: "user", content: userContent }],
    });
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    return text.length > 0 ? text : null;
  } catch (error) {
    // A witness who cannot speak is not a reason to break the covenant.
    console.error("[elerii] generation failed", error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 1. Draft the disclosure                                             */
/* ------------------------------------------------------------------ */

export type DraftDisclosureInput = {
  category: EventCategory;
  occurredAt: Date;
  windowMinutesRemaining: number;
  /** Optional: anything the subject has already typed, in his own words. */
  startingWords?: string;
  allyName?: string;
};

export async function draftDisclosure(input: DraftDisclosureInput): Promise<EleriiResult> {
  if (input.startingWords) {
    const check = checkForCrisis(input.startingWords);
    if (check.crisis) return { text: check.response, generated: false, crisis: true };
  }

  const prompt = [
    `Category: ${EVENT_CATEGORY_LABELS[input.category]}`,
    `Detected at: ${clockTime(input.occurredAt)} on ${longDate(input.occurredAt)}`,
    `He has ${input.windowMinutesRemaining} minutes of his window left.`,
    input.allyName ? `His ally is called ${input.allyName}.` : null,
    input.startingWords ? `\nHe has started writing:\n"""\n${input.startingWords}\n"""` : null,
    "",
    "Draft what he might send.",
  ]
    .filter(Boolean)
    .join("\n");

  const text = await ask("draft-disclosure", DRAFTING_MODEL, prompt, 400);
  if (text) return { text, generated: true };

  return { text: fallbackDisclosure(input), generated: false };
}

/** Plain, factual, and entirely usable as-is. Not a placeholder. */
function fallbackDisclosure(input: DraftDisclosureInput): string {
  return `Something was flagged at ${clockTime(input.occurredAt)} — ${EVENT_CATEGORY_LABELS[
    input.category
  ].toLowerCase()}. I wanted you to hear it from me rather than from the report.`;
}

/* ------------------------------------------------------------------ */
/* 2. The ally's weekly question                                       */
/* ------------------------------------------------------------------ */

export type WeekRhythm = {
  weekStart: Date;
  totalEvents: number;
  disclosedByHim: number;
  lapsed: number;
  contested: number;
  /** Hours of day the week's events fell in, local time. */
  hours: number[];
  /** Consecutive days on which every event was disclosed. Never "days clean". */
  disclosureStreakDays: number;
  silenceHours: number;
};

export async function weeklyQuestion(rhythm: WeekRhythm): Promise<EleriiResult> {
  const prompt = [
    `Week beginning ${longDate(rhythm.weekStart)}.`,
    `Events: ${rhythm.totalEvents}.`,
    `He came forward himself: ${rhythm.disclosedByHim}.`,
    `Window lapsed without a word: ${rhythm.lapsed}.`,
    `He contested as a false positive: ${rhythm.contested}.`,
    rhythm.hours.length > 0
      ? `Times of day: ${rhythm.hours.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ")}.`
      : "No events this week.",
    `Consecutive days of honest disclosure: ${rhythm.disclosureStreakDays}.`,
    rhythm.silenceHours > 0 ? `His device was silent for ${rhythm.silenceHours} hours.` : null,
    "",
    "Write the one question he should bring this week.",
  ]
    .filter(Boolean)
    .join("\n");

  const text = await ask("weekly-question", ROUTINE_MODEL, prompt, 200);
  if (text) return { text, generated: true };

  return { text: fallbackQuestion(rhythm), generated: false };
}

function fallbackQuestion(rhythm: WeekRhythm): string {
  if (rhythm.totalEvents === 0) {
    return "What did an ordinary evening look like this week?";
  }
  if (rhythm.lapsed > 0) {
    return "There was a window you let pass — what was happening in the half hour before it?";
  }
  if (rhythm.hours.some((h) => h >= 22 || h <= 4)) {
    return "What is keeping you up past midnight at the moment?";
  }
  return "You came forward this week. What made it possible to say it out loud?";
}

/* ------------------------------------------------------------------ */
/* 3. Name a pattern — to the subject only                             */
/* ------------------------------------------------------------------ */

export type AntecedentSummary = {
  counts: Partial<Record<AntecedentKind, number>>;
  /** Hours of day the signals clustered in, local time. */
  hours: number[];
  days: number;
};

export async function namePattern(summary: AntecedentSummary): Promise<EleriiResult> {
  const lines = Object.entries(summary.counts)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([kind, count]) => `${ANTECEDENT_KIND_LABELS[kind as AntecedentKind]}: ${count}`);

  if (lines.length === 0) return { text: "", generated: false };

  const prompt = [
    `Signals over the last ${summary.days} days:`,
    ...lines,
    summary.hours.length > 0
      ? `Clustered around: ${summary.hours.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ")}.`
      : null,
    "",
    "Is there a pattern worth naming? If not, say so.",
  ]
    .filter(Boolean)
    .join("\n");

  const text = await ask("name-pattern", ROUTINE_MODEL, prompt, 200);
  if (text) return { text, generated: true };

  return { text: fallbackPattern(summary), generated: false };
}

function fallbackPattern(summary: AntecedentSummary): string {
  const dominant = Object.entries(summary.counts).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0];
  if (!dominant) return "";
  const [kind, count] = dominant;
  const label = ANTECEDENT_KIND_LABELS[kind as AntecedentKind].toLowerCase();
  return `${count} of the last ${summary.days} days show ${label}. That is a circumstance, and circumstances can be changed.`;
}

/**
 * The plain summary of a week's shape, written without a model.
 *
 * The digest always has this; the generated question sits above it. Facts do
 * not need a language model and should not wait on one.
 */
export function plainWeekSummary(rhythm: WeekRhythm): string {
  if (rhythm.totalEvents === 0) {
    return rhythm.silenceHours > 0
      ? `No events this week. His device was silent for ${rhythm.silenceHours} hours.`
      : "No events this week.";
  }

  const parts: string[] = [
    `${rhythm.totalEvents} event${rhythm.totalEvents === 1 ? "" : "s"}.`,
    `He came forward on ${rhythm.disclosedByHim} of them.`,
  ];
  if (rhythm.lapsed > 0) {
    parts.push(`${rhythm.lapsed} window${rhythm.lapsed === 1 ? "" : "s"} lapsed without a word.`);
  }
  if (rhythm.contested > 0) {
    parts.push(`${rhythm.contested} contested as a false positive.`);
  }
  if (rhythm.silenceHours > 0) {
    parts.push(`His device was silent for ${rhythm.silenceHours} hours.`);
  }
  return parts.join(" ");
}

/** Shared shape used by the ally timeline. Declared here so copy cannot drift. */
export type ResolvedOutcome = Exclude<EventState, "PENDING">;
