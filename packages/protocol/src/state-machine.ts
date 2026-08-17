/**
 * The event lifecycle, as an explicit state machine.
 *
 *   sentinel detects → PENDING (windowExpiresAt = receivedAt + graceWindowMinutes)
 *                      → the SUBJECT is notified. Nobody else.
 *
 *   subject discloses in window   → DISCLOSED  → ally: "He told me himself."
 *   subject contests in window    → CONTESTED  → ally: "Flagged; he says false positive."
 *   window expires, no action     → LAPSED     → ally: "An event was not disclosed."
 *
 * Two rules the rest of the codebase leans on:
 *
 *   1. Transitions are one-way and append-only. An Event is never deleted.
 *   2. Once `resolvedAt` is set the event is closed. Nothing reopens it —
 *      not a late disclosure, not an admin, not the sweep job.
 *
 * There is deliberately no transition to a "dismissed" or "hidden" state.
 * A subject may contest an event, but CONTESTED is still surfaced to the ally,
 * labelled as contested. There is no escape hatch.
 */

import type { EventState } from "./categories.js";

/** What can be done to an event, and by whom. */
export const EVENT_ACTIONS = ["DISCLOSE", "CONTEST", "LAPSE"] as const;
export type EventAction = (typeof EVENT_ACTIONS)[number];

/** Who is permitted to take each action. The ally is on nobody's list. */
export const EVENT_ACTION_ACTOR: Record<EventAction, "SUBJECT" | "SYSTEM"> = {
  DISCLOSE: "SUBJECT",
  CONTEST: "SUBJECT",
  LAPSE: "SYSTEM",
};

const TRANSITIONS: Record<EventAction, { from: EventState; to: EventState }> = {
  DISCLOSE: { from: "PENDING", to: "DISCLOSED" },
  CONTEST: { from: "PENDING", to: "CONTESTED" },
  LAPSE: { from: "PENDING", to: "LAPSED" },
};

/** Terminal states. Reaching one sets `resolvedAt` and closes the event. */
export const RESOLVED_STATES: readonly EventState[] = ["DISCLOSED", "CONTESTED", "LAPSED"];

export function isResolved(state: EventState): boolean {
  return RESOLVED_STATES.includes(state);
}

/** Is this event visible to the ally? Only once it has resolved. Never before. */
export function isVisibleToAlly(state: EventState): boolean {
  return isResolved(state);
}

export type TransitionResult =
  | { ok: true; state: EventState }
  | { ok: false; reason: "ALREADY_RESOLVED" | "ILLEGAL_TRANSITION" | "WINDOW_EXPIRED" | "WINDOW_OPEN" };

/**
 * Apply an action to an event.
 *
 * `now` and `windowExpiresAt` are passed in rather than read from the clock so
 * that the sweep job, the API routes and the tests all reason about the same
 * instant.
 */
export function applyAction(input: {
  state: EventState;
  action: EventAction;
  windowExpiresAt: Date;
  now: Date;
}): TransitionResult {
  const { state, action, windowExpiresAt, now } = input;

  if (isResolved(state)) return { ok: false, reason: "ALREADY_RESOLVED" };

  const transition = TRANSITIONS[action];
  if (transition.from !== state) return { ok: false, reason: "ILLEGAL_TRANSITION" };

  const expired = now.getTime() >= windowExpiresAt.getTime();

  // The subject's actions only count inside the window. Past it, the record
  // already speaks — a late disclosure cannot retroactively become "he came
  // forward on his own".
  if (action !== "LAPSE" && expired) return { ok: false, reason: "WINDOW_EXPIRED" };

  // The sweep job may only lapse a window that has actually run out.
  if (action === "LAPSE" && !expired) return { ok: false, reason: "WINDOW_OPEN" };

  return { ok: true, state: transition.to };
}

/** Milliseconds left in the grace window, floored at zero. */
export function msRemaining(windowExpiresAt: Date, now: Date): number {
  return Math.max(0, windowExpiresAt.getTime() - now.getTime());
}

export function windowExpiryFrom(receivedAt: Date, graceWindowMinutes: number): Date {
  return new Date(receivedAt.getTime() + graceWindowMinutes * 60_000);
}

/**
 * How a resolved event is described to the ally. This is the only place the
 * ally-facing wording of an outcome is decided, so it cannot drift between the
 * timeline, the digest and the notification.
 *
 * None of these strings can carry content, because none of them take the
 * content as an input — there is none to take.
 */
export const ALLY_OUTCOME_COPY: Record<Exclude<EventState, "PENDING">, string> = {
  DISCLOSED: "He told you himself.",
  CONTESTED: "Flagged. He says it was a false positive.",
  LAPSED: "An event was not disclosed.",
};
