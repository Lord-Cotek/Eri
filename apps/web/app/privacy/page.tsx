import type { Metadata } from "next";
import Link from "next/link";

import { Markdown } from "@/components/Markdown";
import { EriMark } from "@/components/ui/EriMark";
import { CotekEyebrow, Eyebrow } from "@/components/ui";
import { PRIVACY_VERSION, privacyPolicy } from "@/lib/legal";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Ẹ̀rí collects, who can see it, and the far longer list of what it never collects. Detection happens on your device; no image, address or page text is ever transmitted.",
  alternates: { canonical: `${siteUrl()}/privacy` },
  // Public and indexable on purpose: both app stores require a privacy policy
  // reachable without signing in.
  robots: { index: true, follow: true },
};

/**
 * The privacy policy.
 *
 * Deliberately outside `Shell`: it must render for someone with no account, no
 * covenant and no session — a store reviewer, or a man deciding whether to
 * install this at all — so it carries its own minimal frame.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3 text-ink transition-colors hover:text-steel">
            <EriMark size={22} className="text-steel" title="Ẹ̀rí" />
            <span className="font-serif text-lg">Ẹ̀rí</span>
          </Link>
          <Eyebrow>Version {PRIVACY_VERSION}</Eyebrow>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <Markdown source={privacyPolicy()} />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-10 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <CotekEyebrow />
          <p>The image never leaves the device. Nothing here has ever seen it.</p>
        </div>
      </footer>
    </div>
  );
}
