import Anthropic from "@anthropic-ai/sdk";

import { blank } from "@/lib/env";

/**
 * Server-only. Never import this into a client component.
 *
 * Cost-aware model choice is a COTEK concern: Sonnet where a man's own words
 * are being drafted for him, Haiku for routine generation. Nothing here is hard
 * enough to want Opus.
 */
export const anthropic = new Anthropic({ apiKey: blank(process.env.ANTHROPIC_API_KEY) ?? "" });

/** Drafting a disclosure — the one place the output stands in for a man's voice. */
export const DRAFTING_MODEL = blank(process.env.ANTHROPIC_MODEL_DRAFTING) ?? "claude-sonnet-5";

/** Weekly questions and pattern notes — short, frequent, routine. */
export const ROUTINE_MODEL = blank(process.env.ANTHROPIC_MODEL_ROUTINE) ?? "claude-haiku-4-5-20251001";

/**
 * Whether the AI layer is reachable at all.
 *
 * Ẹlẹ́rìí is an assistant to the covenant, not a dependency of it. Every caller
 * has a plain non-generated fallback, so a missing key degrades the product
 * rather than breaking it.
 */
export function isEleriiConfigured(): boolean {
  return Boolean(blank(process.env.ANTHROPIC_API_KEY));
}
