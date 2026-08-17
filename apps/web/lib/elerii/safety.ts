/**
 * The crisis tripwire.
 *
 * Ẹlẹ́rìí is instructed to stop and surface a person on any sign of despair,
 * self-harm, or suicidal ideation. Instruction is not a mechanism, so this
 * checks the subject's own text *before* it reaches the model and short-circuits
 * the flow — the request is never sent, and a fixed response is returned.
 *
 * This is deliberately blunt and deliberately over-triggers. A false positive
 * costs a man one screen telling him to talk to someone. A false negative costs
 * something we are not willing to risk to save a screen.
 */

const CRISIS_PATTERNS: RegExp[] = [
  /\bkill(ing)?\s+my ?self\b/i,
  /\bend(ing)?\s+(it|my life|things)\b/i,
  /\btake\s+my\s+own\s+life\b/i,
  /\bsuicid(e|al)\b/i,
  /\bself[-\s]?harm\b/i,
  /\bhurt(ing)?\s+my ?self\b/i,
  /\bcut(ting)?\s+my ?self\b/i,
  /\bdon'?t\s+want\s+to\s+(be here|live|wake up)\b/i,
  /\bbetter\s+off\s+(dead|without me)\b/i,
  /\bno\s+(point|reason)\s+(in\s+)?(going on|living|any ?more)\b/i,
  /\bcan'?t\s+(go on|do this any ?more|keep going)\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bworthless\b.*\bshould\b/i,
];

export type CrisisCheck = { crisis: false } | { crisis: true; response: string };

export function crisisResources(): { name: string; contact: string } {
  return {
    name: process.env.CRISIS_LINE_NAME ?? "Samaritans",
    contact: process.env.CRISIS_LINE_CONTACT ?? "116 123 (UK, 24 hours)",
  };
}

/**
 * The fixed response. Not generated, so it cannot drift, be argued with, or be
 * talked past by a longer message.
 */
export function crisisResponse(): string {
  const { name, contact } = crisisResources();
  return [
    "I am stopping here, because this needs a person and I am not one.",
    "",
    "Tell your ally now — not in a grace window, now. Then call your pastor.",
    "",
    `If you are in danger tonight, contact ${name}: ${contact}.`,
    "",
    "I will not draft anything else until you have spoken to someone.",
  ].join("\n");
}

/** Check text a person wrote before it reaches the model. */
export function checkForCrisis(text: string): CrisisCheck {
  const hit = CRISIS_PATTERNS.some((pattern) => pattern.test(text));
  return hit ? { crisis: true, response: crisisResponse() } : { crisis: false };
}
