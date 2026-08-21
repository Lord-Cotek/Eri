import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The published legal documents.
 *
 * Both are read from `content/` rather than embedded in a component, so the
 * text a lawyer reviews is the text that renders, and a wording change is a
 * one-file diff.
 */

/**
 * The version of `content/privacy-policy.md` currently published. Bump it
 * whenever the wording changes — the stores and the policy itself both cite it.
 */
export const PRIVACY_VERSION = "2026-08-19";

let cached: string | null = null;

export function privacyPolicy(): string {
  cached ??= readFileSync(join(process.cwd(), "content", "privacy-policy.md"), "utf8");
  return cached;
}
