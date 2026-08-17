"use server";

/**
 * The two things a subject can do inside his window.
 *
 * There is no third one. There is no dismiss, no snooze, no "not now". The
 * window either closes because he spoke, or it closes on its own and that is
 * reported too.
 */

import { revalidatePath } from "next/cache";
import { DISCLOSURE_NOTE_MAX_LENGTH } from "@eri/protocol";

import { currentUserId } from "@/lib/auth";
import { resolveBySubject } from "@/lib/events";
import { checkForCrisis } from "@/lib/elerii/safety";
import type { ActionState } from "@/app/actions/covenant";

const REASONS: Record<string, string> = {
  NOT_FOUND: "That event does not exist.",
  NOT_YOURS: "That is not your event.",
  ALREADY_RESOLVED: "That event has already been settled.",
  WINDOW_EXPIRED: "The window closed. It has been reported as it stands.",
  ILLEGAL: "That cannot be done to this event.",
};

export type DiscloseState = ActionState & { crisis?: string };

export async function discloseAction(_prev: DiscloseState, formData: FormData): Promise<DiscloseState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Sign in first." };

  const eventId = String(formData.get("eventId") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, DISCLOSURE_NOTE_MAX_LENGTH);

  // The tripwire runs before anything is recorded. A man in crisis needs a
  // person, not a successful form submission.
  const check = checkForCrisis(note);
  if (check.crisis) return { crisis: check.response };

  const result = await resolveBySubject({ eventId, subjectId: userId, action: "DISCLOSE", note });
  if (!result.ok) return { error: REASONS[result.reason] ?? "That did not work." };

  revalidatePath("/subject");
  revalidatePath("/ally");
  return { ok: true };
}

/**
 * Contest.
 *
 * This is not a dismissal and the form says so before he presses it. The event
 * becomes CONTESTED and the ally is told, labelled as contested.
 */
export async function contestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Sign in first." };

  const eventId = String(formData.get("eventId") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, DISCLOSURE_NOTE_MAX_LENGTH);

  const check = checkForCrisis(note);
  if (check.crisis) return { error: check.response };

  const result = await resolveBySubject({ eventId, subjectId: userId, action: "CONTEST", note });
  if (!result.ok) return { error: REASONS[result.reason] ?? "That did not work." };

  revalidatePath("/subject");
  revalidatePath("/ally");
  return { ok: true };
}
