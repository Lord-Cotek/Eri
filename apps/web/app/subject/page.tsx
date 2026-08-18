import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ANTECEDENT_KIND_LABELS, EVENT_CATEGORY_LABELS } from "@eri/protocol";

import { InvitePanel } from "@/components/InvitePanel";
import { PendingEventCard } from "@/components/PendingEventCard";
import { RhythmChart } from "@/components/RhythmChart";
import { Shell } from "@/components/Shell";
import { Button, Card, Eyebrow, Notice, StatCard } from "@/components/ui";
import { currentUserId } from "@/lib/auth";
import { displayName, inviteUrl, subjectCovenant } from "@/lib/covenant";
import { namePattern } from "@/lib/elerii";
import {
  antecedentSummary,
  disclosureRhythm,
  disclosureStreakDays,
  justResolvedEvent,
  openSilences,
  pendingEvent,
  recentAntecedents,
} from "@/lib/queries";
import { clockTime, dayAndTime, longDate } from "@/lib/time";
import { simulatorEnabled } from "@/lib/dev-simulator";

export const metadata: Metadata = { title: "You", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * How a just-settled event is described back to him.
 *
 * Sober in all three cases. Disclosing is not congratulated — he did a normal
 * thing that honesty requires, and the sentence says what happened, not how he
 * should feel about it.
 */
type Resolution = "DISCLOSED" | "CONTESTED" | "LAPSED";

const RESOLUTION_TONE: Record<Resolution, "sage" | "steel" | "amber"> = {
  DISCLOSED: "sage",
  CONTESTED: "steel",
  LAPSED: "amber",
};

const RESOLUTION_EYEBROW: Record<Resolution, string> = {
  DISCLOSED: "Sent",
  CONTESTED: "Contested",
  LAPSED: "The window closed",
};

const RESOLUTION_HEADLINE: Record<Resolution, (ally: string) => string> = {
  DISCLOSED: (ally) => `${ally} has been told that you came forward yourself.`,
  CONTESTED: (ally) => `${ally} has been told you say this was a false positive.`,
  LAPSED: (ally) => `${ally} has been told an event was not disclosed.`,
};

/**
 * His own surface.
 *
 * Order matters: the open window comes first, the pre-emptive nudge second, the
 * rhythm last. The intervention belongs before the event, so a nudge sits above
 * a chart of what already happened.
 */
export default async function SubjectPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?callbackUrl=/subject");

  const covenant = await subjectCovenant(userId);

  if (!covenant) {
    return (
      <Shell active="/subject" showSimulator={simulatorEnabled()}>
        <div className="rise max-w-prose">
          <Eyebrow>You</Eyebrow>
          <h1 className="mt-5 font-serif text-3xl">You are not in a covenant yet.</h1>
          <p className="mt-4 text-sm text-muted">
            Ẹ̀rí does nothing on its own. It needs two men who both signed.
          </p>
          <div className="mt-8">
            <Button href="/covenant/new">Start a covenant</Button>
          </div>
        </div>
      </Shell>
    );
  }

  const allyName = covenant.ally ? displayName(covenant.ally) : "your ally";

  if (covenant.status === "PENDING") {
    return (
      <Shell active="/subject" showSimulator={simulatorEnabled()}>
        <div className="rise max-w-prose space-y-10">
          <div>
            <Eyebrow>Waiting</Eyebrow>
            <h1 className="mt-5 font-serif text-3xl">He has not signed yet.</h1>
            <p className="mt-4 text-sm text-muted">
              Nothing is being recorded and no device can register until he does. That is the point — one
              man&apos;s consent is not a covenant.
            </p>
            <p className="mt-3 text-sm text-muted">
              The invitation expires on {longDate(covenant.inviteExpiresAt)}.
            </p>
          </div>

          <InvitePanel
            covenantId={covenant.id}
            inviteEmail={covenant.inviteEmail}
            inviteUrl={inviteUrl(covenant.inviteToken)}
            sent={Boolean(covenant.inviteSentAt)}
          />
        </div>
      </Shell>
    );
  }

  const [pending, justResolved, rhythm, streak, antecedents, summary, silences] = await Promise.all([
    pendingEvent(covenant.id),
    justResolvedEvent(covenant.id),
    disclosureRhythm(covenant.id),
    disclosureStreakDays(covenant.id),
    recentAntecedents(userId),
    antecedentSummary(userId),
    openSilences(userId),
  ]);

  // The pattern is named only when there is something to name, and only ever
  // to him. The ally never sees an individual antecedent.
  const pattern = antecedents.length > 0 ? await namePattern(summary) : { text: "", generated: false };

  const totalEvents = rhythm.reduce((sum, point) => sum + point.events, 0);
  const disclosed = rhythm.reduce((sum, point) => sum + point.disclosed, 0);
  const lapsed = rhythm.reduce((sum, point) => sum + point.lapsed, 0);

  return (
    <Shell active="/subject" showSimulator={simulatorEnabled()}>
      <div className="rise space-y-12">
        {/* ── The open window ──────────────────────────────────────── */}
        {pending && (
          <section>
            <PendingEventCard
              eventId={pending.id}
              category={pending.category}
              occurredAt={pending.occurredAt.toISOString()}
              windowExpiresAt={pending.windowExpiresAt.toISOString()}
              allyName={allyName}
            />
          </section>
        )}

        {/* ── What just happened ───────────────────────────────────── */}
        {!pending && justResolved && justResolved.state !== "PENDING" && (
          <section>
            <Card tone={RESOLUTION_TONE[justResolved.state]} className="p-8">
              <Eyebrow>{RESOLUTION_EYEBROW[justResolved.state]}</Eyebrow>
              <p className="mt-4 font-serif text-2xl">
                {RESOLUTION_HEADLINE[justResolved.state](allyName)}
              </p>
              <p className="mt-4 text-sm text-muted">
                {EVENT_CATEGORY_LABELS[justResolved.category]} at {clockTime(justResolved.occurredAt)}.
                {justResolved.resolvedAt ? ` Settled at ${clockTime(justResolved.resolvedAt)}.` : ""}
              </p>
              {justResolved.disclosureNote && (
                <p className="mt-4 border-l-2 border-border pl-4 text-sm text-ink">
                  {justResolved.disclosureNote}
                </p>
              )}
            </Card>
          </section>
        )}

        {/* ── The nudge, before the event ──────────────────────────── */}
        {pattern.text && (
          <section>
            <Eyebrow>Before it happens</Eyebrow>
            <Card className="mt-4 p-6">
              <p className="text-sm text-ink">{pattern.text}</p>
              <p className="mt-3 text-xs text-muted">
                {allyName} does not see this. Antecedents are yours — only the shape of a week ever reaches him.
              </p>
            </Card>
          </section>
        )}

        {silences.length > 0 && (
          <section>
            <Notice tone="alert">
              {silences.map((silence) => (
                <p key={silence.id}>
                  {silence.device.label} has been quiet since {dayAndTime(silence.startedAt)}.
                  {silence.allyNotifiedAt ? ` ${allyName} has been told.` : ""}
                </p>
              ))}
            </Notice>
          </section>
        )}

        {/* ── The rhythm ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between gap-4">
            <Eyebrow>Your rhythm — last thirty days</Eyebrow>
            {!pending && <span className="text-xs text-muted">No open window.</span>}
          </div>

          <div className="mt-4 grid gap-px border border-border bg-border sm:grid-cols-3">
            <StatCard
              label="Days of honest disclosure"
              value={String(streak)}
              note="Days without a window you let pass. Not days clean — Ẹ̀rí does not measure that."
              tone={streak > 0 ? "sage" : "neutral"}
            />
            <StatCard
              label="You came forward"
              value={`${disclosed} of ${totalEvents}`}
              note="Events you owned before the window closed."
            />
            <StatCard
              label="Windows lapsed"
              value={String(lapsed)}
              note={lapsed === 0 ? "None. That is the fact, not a compliment." : "Reported as they stand."}
              tone={lapsed > 0 ? "amber" : "neutral"}
            />
          </div>

          <div className="mt-6">
            <RhythmChart data={rhythm} />
          </div>
        </section>

        {/* ── Recent antecedents ───────────────────────────────────── */}
        {antecedents.length > 0 && (
          <section>
            <Eyebrow>Circumstances — last 48 hours</Eyebrow>
            <p className="mt-3 max-w-prose text-xs text-muted">
              Pattern signals from your devices. Not content, not events, and never shown to {allyName}
              individually.
            </p>
            <ul className="mt-4 divide-y divide-border border border-border">
              {antecedents.slice(0, 8).map((antecedent) => (
                <li key={antecedent.id} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-muted">{ANTECEDENT_KIND_LABELS[antecedent.kind]}</span>
                  <span className="font-mono text-xs text-muted">{clockTime(antecedent.occurredAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Shell>
  );
}
