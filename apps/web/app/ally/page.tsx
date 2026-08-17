import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ALLY_OUTCOME_COPY, EVENT_CATEGORY_LABELS } from "@eri/protocol";

import { Shell } from "@/components/Shell";
import { StillHereButton } from "@/components/StillHereButton";
import { Card, Eyebrow, Notice, TONE_TEXT, type Tone } from "@/components/ui";
import { currentUserId } from "@/lib/auth";
import { allyCovenant, displayName } from "@/lib/covenant";
import { allyTimeline, latestDigest, openSilences } from "@/lib/queries";
import { dayAndTime, longDate } from "@/lib/time";
import { simulatorEnabled } from "@/lib/dev-simulator";

export const metadata: Metadata = { title: "Ally", robots: { index: false } };
export const dynamic = "force-dynamic";

const OUTCOME_TONE: Record<"DISCLOSED" | "CONTESTED" | "LAPSED", Tone> = {
  DISCLOSED: "sage",
  CONTESTED: "steel",
  LAPSED: "amber",
};

/**
 * The ally's surface. A rhythm, not a feed.
 *
 * This is the half every competitor gets wrong — allies stop reading reports
 * within about six weeks — so the page is built around one question rather
 * than a list. The timeline is underneath it, sober and small, and it contains
 * resolved events only. There is nothing on this page during a grace window.
 */
export default async function AllyPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?callbackUrl=/ally");

  const covenant = await allyCovenant(userId);

  if (!covenant) {
    return (
      <Shell active="/ally" showSimulator={simulatorEnabled()}>
        <div className="rise max-w-prose">
          <Eyebrow>Ally</Eyebrow>
          <h1 className="mt-5 font-serif text-3xl">Nobody has asked you yet.</h1>
          <p className="mt-4 text-sm text-muted">
            An ally is invited by the man himself. If someone has asked you, the invitation arrived by email
            with a link.
          </p>
        </div>
      </Shell>
    );
  }

  const subject = displayName(covenant.subject);

  if (covenant.status === "REVOKED") {
    return (
      <Shell active="/ally" showSimulator={simulatorEnabled()}>
        <div className="rise max-w-prose">
          <Eyebrow>Ended</Eyebrow>
          <h1 className="mt-5 font-serif text-3xl">
            {covenant.revokedBy === "SUBJECT" ? `${subject} ended the covenant.` : "This covenant has ended."}
          </h1>
          <p className="mt-4 text-sm text-muted">
            {covenant.revokedAt ? `On ${longDate(covenant.revokedAt)}. ` : ""}
            He was within his rights to do that at any time, and you were told because he did. No further
            events will reach you.
          </p>
          <p className="mt-4 text-sm text-muted">
            The record of what came before is not deleted. Nothing here is.
          </p>
        </div>
      </Shell>
    );
  }

  const [digest, timeline, silences] = await Promise.all([
    latestDigest(covenant.id),
    allyTimeline(covenant.id, userId),
    openSilences(covenant.subjectId),
  ]);

  return (
    <Shell active="/ally" showSimulator={simulatorEnabled()}>
      <div className="rise space-y-12">
        {/* ── The question. The top of the page, always. ───────────── */}
        <section>
          <Eyebrow>Ask him this week</Eyebrow>
          {digest ? (
            <Card tone="steel" className="mt-4 p-8">
              <h1 className="font-serif text-2xl leading-snug">{digest.questionText}</h1>
              <p className="mt-6 text-sm text-muted">{digest.summaryText}</p>
              <div className="mt-6 border-t border-border pt-4">
                <StillHereButton digestId={digest.id} />
              </div>
            </Card>
          ) : (
            <Card className="mt-4 p-8">
              <h1 className="font-serif text-2xl leading-snug">How has this week actually been?</h1>
              <p className="mt-6 text-sm text-muted">
                The first digest arrives at the end of the week. Until then, that question is as good as any.
              </p>
            </Card>
          )}
        </section>

        {/* ── Silence ──────────────────────────────────────────────── */}
        {silences.filter((s) => s.severity === "ALERT").length > 0 && (
          <section>
            <Eyebrow>A device went quiet</Eyebrow>
            <div className="mt-4 space-y-3">
              {silences
                .filter((s) => s.severity === "ALERT")
                .map((silence) => (
                  <Notice key={silence.id} tone="alert">
                    {silence.device.label} has not reported since {dayAndTime(silence.startedAt)}. That may be a
                    flat battery, a lost phone, or the app being gone. Ẹ̀rí cannot tell which.
                  </Notice>
                ))}
            </div>
          </section>
        )}

        {/* ── The timeline. Resolved events only. ──────────────────── */}
        <section>
          <div className="flex items-baseline justify-between gap-4">
            <Eyebrow>What has been reported</Eyebrow>
            <span className="text-xs text-muted">Category and time only. Never the content.</span>
          </div>

          {timeline.length === 0 ? (
            <Card className="mt-4 p-8">
              <p className="text-sm text-muted">
                Nothing has been reported. When something is, it appears here: a category, a time, and whether
                he came forward. Until then this page is quiet, and its quiet tells you nothing either way.
              </p>
            </Card>
          ) : (
            <ul className="mt-4 divide-y divide-border border border-border">
              {timeline.map((entry) => (
                <li key={entry.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className={`text-sm ${TONE_TEXT[OUTCOME_TONE[entry.state]]}`}>
                      {ALLY_OUTCOME_COPY[entry.state]}
                    </span>
                    <span className="font-mono text-xs text-muted">{dayAndTime(entry.occurredAt)}</span>
                  </div>

                  <p className="mt-2 text-xs uppercase tracking-[0.15em] text-muted">
                    {EVENT_CATEGORY_LABELS[entry.category]}
                  </p>

                  {entry.disclosureNote && (
                    <p className="mt-4 border-l-2 border-sage/40 pl-4 text-sm text-ink">
                      {entry.disclosureNote}
                    </p>
                  )}

                  <div className="mt-4">
                    <StillHereButton eventId={entry.id} acknowledged={entry.acknowledged} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Guidance ─────────────────────────────────────────────── */}
        <section className="border-t border-border pt-10">
          <Eyebrow>Being an ally</Eyebrow>
          <div className="mt-5 grid gap-8 sm:grid-cols-2">
            <div className="max-w-prose space-y-3 text-sm text-muted">
              <p className="text-ink">What helps</p>
              <p>
                Ask the question. Ask it once, in person or on the phone, and then listen to the whole answer
                without solving it.
              </p>
              <p>
                When he came forward himself, say that you noticed. Not "well done" — he did a normal thing that
                honesty requires. Just that you saw it.
              </p>
              <p>Keep showing up in the weeks when nothing happens. Those are most of the weeks.</p>
            </div>

            <div className="max-w-prose space-y-3 text-sm text-muted">
              <p className="text-ink">What is not yours</p>
              <p>
                You are not his counsellor, not his pastor, and not responsible for his choices. You cannot
                want this for him harder than he wants it.
              </p>
              <p>
                Do not interrogate him about what it was. You do not know, and neither does anyone else — that
                is the design, not a limitation.
              </p>
              <p>
                If he tells you he is in real trouble, that is bigger than this app. Get him to a person: his
                pastor, his doctor, a crisis line.
              </p>
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
