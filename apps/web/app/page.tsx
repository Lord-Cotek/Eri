import type { Metadata } from "next";
import Link from "next/link";

import { EriMark } from "@/components/ui/EriMark";
import { Button, CotekEyebrow, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Ẹ̀rí — you get the chance to speak first",
  description:
    "An accountability covenant between two men. Detection happens on your device; the image never leaves it. When something is flagged, you are told first and given the chance to tell him yourself.",
};

/**
 * The landing page.
 *
 * It has one job: explain the inversion honestly, including the parts that are
 * not flattering. No testimonials, no statistics about pornography, no urgency.
 * A man deciding whether to install this on himself deserves the plain shape of
 * it, and nothing that reads as a sales page.
 */
export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <span className="flex items-center gap-3">
            <EriMark size={22} className="text-steel" title="Ẹ̀rí" />
            <span className="font-serif text-lg">Ẹ̀rí</span>
          </span>
          <Link href="/signin" className="text-xs uppercase tracking-[0.15em] text-muted hover:text-ink">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6">
        {/* ── The claim ────────────────────────────────────────────── */}
        <section className="rise border-b border-border py-20">
          <Eyebrow>Ẹ̀rí — Yoruba: witness, testimony, record</Eyebrow>
          <h1 className="mt-6 max-w-prose font-serif text-4xl leading-tight sm:text-5xl">
            You get the chance to speak first.
          </h1>
          <div className="mt-8 max-w-prose space-y-4 text-muted">
            <p>
              Ẹ̀rí is an accountability covenant between two adults. One man installs it on his own devices. One
              man agrees to be told.
            </p>
            <p>
              When something is detected, nothing goes to your ally. Not yet. A window opens — thirty minutes
              by default — and <span className="text-ink">you</span> are the one who is notified:
            </p>
            <p className="border-l-2 border-steel/40 pl-4 text-ink">
              Something was flagged at 01:14. Do you want to tell him yourself?
            </p>
            <p>
              If you tell him inside that window, he is told that you came forward on your own. If the window
              lapses, he is told plainly that an event occurred and was not disclosed. Either way, he never
              sees what it was.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button href="/covenant/new">Start a covenant</Button>
            <Button href="/signin" variant="ghost">
              Sign in
            </Button>
          </div>
        </section>

        {/* ── The inversion ────────────────────────────────────────── */}
        <section className="border-b border-border py-16">
          <Eyebrow>What is different</Eyebrow>
          <h2 className="mt-5 max-w-prose font-serif text-2xl">This is not surveillance.</h2>
          <div className="mt-6 max-w-prose space-y-4 text-muted">
            <p>
              Other products in this category screenshot your phone and send the pictures to your accountability
              partner, blurred. That is monitoring, and it treats a man as something to be watched.
            </p>
            <p>
              Ẹ̀rí inverts it. The classifier runs <span className="text-ink">on your device</span>. The image,
              the page, the video — none of it is ever sent anywhere, to anyone, including us. What crosses the
              network is a category, a timestamp, and a number.
            </p>
            <p>
              Your ally learns that something happened, roughly what kind, when, and whether you owned it. That
              is all there is to learn, because that is all there is.
            </p>
          </div>
        </section>

        {/* ── What we won't pretend ────────────────────────────────── */}
        <section className="border-b border-border py-16">
          <Eyebrow>What it cannot do</Eyebrow>
          <h2 className="mt-5 max-w-prose font-serif text-2xl">You can uninstall it. So we report the silence.</h2>
          <div className="mt-6 max-w-prose space-y-4 text-muted">
            <p>
              No app can make itself un-uninstallable, and any product that implies otherwise is selling you
              something. Ẹ̀rí does not try.
            </p>
            <p>
              What it does instead is make its absence reportable. Your devices check in every fifteen minutes.
              If one stops, your ally is told it went quiet. Ẹ̀rí cannot tell whether that was a flat battery, a
              lost phone, or a decision — only that it happened.
            </p>
            <p className="text-ink">Silence is the loudest signal in this system.</p>
          </div>
        </section>

        {/* ── The measurement ──────────────────────────────────────── */}
        <section className="border-b border-border py-16">
          <Eyebrow>What is counted</Eyebrow>
          <h2 className="mt-5 max-w-prose font-serif text-2xl">Days of honest disclosure. Never days clean.</h2>
          <div className="mt-6 max-w-prose space-y-4 text-muted">
            <p>
              Ẹ̀rí does not keep a purity score and there is no counter here to protect. There are no badges, no
              streak flames, no congratulation. A man who came forward did a normal thing that honesty
              requires, and being told "great job" for it is its own kind of insult.
            </p>
            <p>
              Marking something as a false positive is not a way out either. It is still reported to your ally,
              labelled as contested. There is no button in this product that makes an event disappear.
            </p>
          </div>
        </section>

        {/* ── Consent ──────────────────────────────────────────────── */}
        <section className="border-b border-border py-16">
          <Eyebrow>Consent</Eyebrow>
          <h2 className="mt-5 max-w-prose font-serif text-2xl">You install it on yourself. You can end it.</h2>
          <div className="mt-6 max-w-prose space-y-4 text-muted">
            <p>
              Nobody may install this on anyone else. It is not a parental control and it is not something a
              wife, an employer or a church can put on a man. If someone is asking you to sign this under
              pressure, do not sign it.
            </p>
            <p>
              You can end the covenant at any time, for any reason, without explaining yourself. Your ally will
              be told immediately when you do — that is the one condition, and it is stated on the button
              before you press it.
            </p>
          </div>
        </section>

        {/* ── Ẹlẹ́rìí ────────────────────────────────────────────────── */}
        <section className="py-16">
          <Eyebrow>Ẹlẹ́rìí — the one who bears witness</Eyebrow>
          <h2 className="mt-5 max-w-prose font-serif text-2xl">A witness, not a judge.</h2>
          <div className="mt-6 max-w-prose space-y-4 text-muted">
            <p>
              Ẹlẹ́rìí helps with three things: drafting a disclosure when you cannot find the words, writing the
              one question your ally should bring you this week, and naming a pattern in your own circumstances
              — late hours, phone off the charger — that you might not have seen.
            </p>
            <p>
              He never renders a verdict on the state of your heart. He does not have your content and he is
              instructed never to imagine it. Conviction belongs to the Holy Spirit, judgement to God, and
              pastoral care to your pastor.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Button href="/covenant/new">Start a covenant</Button>
            <Link href="/covenant/new#terms" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
              Read the terms first
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-10 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <CotekEyebrow />
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
              Privacy
            </Link>
            <p>For adults, entered freely, by both.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
