import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GraceWindowForm, RevokeForm } from "@/components/SettingsForms";
import { Shell } from "@/components/Shell";
import { SignOutButton } from "@/components/SignInForm";
import { Eyebrow, Notice } from "@/components/ui";
import { currentUserId } from "@/lib/auth";
import { TERMS_VERSION, allyCovenant, displayName, endedCovenant, subjectCovenant } from "@/lib/covenant";
import { crisisResources } from "@/lib/elerii/safety";
import { longDate } from "@/lib/time";
import { simulatorEnabled } from "@/lib/dev-simulator";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?callbackUrl=/settings");

  const [asSubject, asAlly, ended] = await Promise.all([
    subjectCovenant(userId),
    allyCovenant(userId),
    endedCovenant(userId),
  ]);
  const crisis = crisisResources();

  return (
    <Shell active="/settings" showSimulator={simulatorEnabled()}>
      <div className="rise space-y-14">
        <section className="max-w-prose">
          <Eyebrow>Settings</Eyebrow>
          <h1 className="mt-5 font-serif text-3xl">Your covenant.</h1>
        </section>

        {asSubject?.status === "ACTIVE" && (
          <>
            <section>
              <Eyebrow>Grace window</Eyebrow>
              <div className="mt-5">
                <GraceWindowForm
                  current={asSubject.graceWindowMinutes}
                  allyName={displayName(asSubject.ally)}
                />
              </div>
            </section>

            <section className="border-t border-border pt-10">
              <Eyebrow>Ending it</Eyebrow>
              <p className="mt-4 max-w-prose text-sm text-muted">
                You signed version {TERMS_VERSION} of the terms
                {asSubject.subjectSignedAt ? ` on ${longDate(asSubject.subjectSignedAt)}` : ""}. You may end
                this at any time.
              </p>
              <div className="mt-6">
                <RevokeForm covenantId={asSubject.id} allyName={displayName(asSubject.ally)} />
              </div>
            </section>
          </>
        )}

        {asSubject?.status === "PENDING" && (
          <section>
            <Notice tone="steel">
              Your ally has not signed yet. Settings become available once he has.
            </Notice>
          </section>
        )}

        {asAlly?.status === "ACTIVE" && (
          <section className="border-t border-border pt-10">
            <Eyebrow>You are an ally</Eyebrow>
            <p className="mt-4 max-w-prose text-sm text-muted">
              You stand with {displayName(asAlly.subject)}. You may step down at any time, and he will be told
              immediately when you do.
            </p>
            <div className="mt-6">
              <RevokeForm covenantId={asAlly.id} allyName={displayName(asAlly.subject)} />
            </div>
          </section>
        )}

        {ended && (
          <section className="border-t border-border pt-10">
            <Eyebrow>Ended</Eyebrow>
            <h2 className="mt-5 font-serif text-2xl">
              {ended.revokedBy === "SUBJECT" && ended.subjectId === userId
                ? `${displayName(ended.ally)} was told immediately.`
                : "This covenant has ended."}
            </h2>
            <p className="mt-4 max-w-prose text-sm text-muted">
              {ended.revokedAt ? `Ended on ${longDate(ended.revokedAt)}. ` : ""}
              It is permanently marked as ended by{" "}
              {ended.revokedBy === "SUBJECT" ? "the subject" : "the ally"}. Nothing already recorded has been
              deleted — events are never deleted.
            </p>
            {ended.subjectId === userId && (
              <p className="mt-4 max-w-prose text-sm text-muted">
                You may start a new covenant whenever you want to. Starting one does not undo this.
              </p>
            )}
          </section>
        )}

        {!asSubject && !asAlly && !ended && (
          <section>
            <Notice tone="steel">You are not in a covenant. There is nothing here to configure yet.</Notice>
          </section>
        )}

        <section className="border-t border-border pt-10">
          <Eyebrow>If you are in trouble tonight</Eyebrow>
          <p className="mt-4 max-w-prose text-sm text-muted">
            Ẹ̀rí is not therapy, not treatment, and not pastoral care. If you are in crisis, this is the wrong
            tool. Tell your ally now — not in a window, now — and call your pastor.
          </p>
          <p className="mt-3 max-w-prose text-sm text-ink">
            {crisis.name}: {crisis.contact}
            {crisis.hours ? ` — ${crisis.hours}` : ""}
          </p>
          <p className="mt-2 max-w-prose text-sm text-ink">
            If that line is closed, or you are in danger tonight: {crisis.emergency}.
          </p>
        </section>

        <section className="border-t border-border pt-10">
          <SignOutButton />
        </section>
      </div>
    </Shell>
  );
}
