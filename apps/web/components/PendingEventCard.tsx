"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { DISCLOSURE_NOTE_MAX_LENGTH, EVENT_CATEGORY_LABELS, type EventCategory } from "@eri/protocol";

import { contestAction, discloseAction, type DiscloseState } from "@/app/actions/events";
import type { ActionState } from "@/app/actions/covenant";
import { Card, Eyebrow, Notice } from "@/components/ui";

/**
 * The card a man sees when a window is open.
 *
 * Deliberate choices, all of them reversible only by argument:
 *
 *   - No red, no exclamation marks, no shame language. Steel, which means
 *     resting, because he has not done anything wrong *here* — here he is
 *     deciding whether to be honest, and that is a neutral moment.
 *   - The countdown is a plain clock, not a draining bar. A bar is a pressure
 *     device and pressure is not what produces honesty.
 *   - One primary action. "Tell him yourself." Contesting is available and
 *     honest about what it costs.
 */

type Props = {
  eventId: string;
  category: EventCategory;
  occurredAt: string;
  windowExpiresAt: string;
  allyName: string;
};

function useCountdown(expiresAt: string): { text: string; expired: boolean } {
  const target = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Rendered blank on the server so the markup does not disagree with the
  // client on first paint.
  if (now === null) return { text: "", expired: false };

  const remaining = Math.max(0, target - now);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return {
    text: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    expired: remaining === 0,
  };
}

function SubmitButton({ children, tone }: { children: string; tone: "primary" | "ghost" }) {
  const { pending } = useFormStatus();
  const cls =
    tone === "primary"
      ? "border border-steel text-steel hover:bg-steel hover:text-bg"
      : "border border-border text-muted hover:border-ink hover:text-ink";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center px-5 py-2.5 text-sm transition-colors duration-200 ease-editorial disabled:opacity-40 ${cls}`}
    >
      {pending ? "Sending" : children}
    </button>
  );
}

export function PendingEventCard({ eventId, category, occurredAt, windowExpiresAt, allyName }: Props) {
  const { text, expired } = useCountdown(windowExpiresAt);
  const [note, setNote] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [showContest, setShowContest] = useState(false);

  const [discloseState, disclose] = useFormState<DiscloseState, FormData>(discloseAction, {});
  const [contestState, contest] = useFormState<ActionState, FormData>(contestAction, {});

  const clock = new Date(occurredAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  async function askElerii() {
    setDrafting(true);
    setDraftError(null);
    try {
      const response = await fetch("/api/elerii/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, startingWords: note || undefined }),
      });
      const data = (await response.json()) as { text?: string; error?: string; crisis?: boolean };
      if (!response.ok || !data.text) {
        setDraftError("Ẹlẹ́rìí could not draft anything just now. Your own words are better anyway.");
        return;
      }
      setNote(data.text);
    } catch {
      setDraftError("Ẹlẹ́rìí could not be reached. Write it yourself — it is your voice he wants.");
    } finally {
      setDrafting(false);
    }
  }

  if (discloseState.crisis) {
    return (
      <Card tone="alert" className="p-8">
        <Eyebrow>Stop</Eyebrow>
        <p className="mt-4 whitespace-pre-line text-sm text-ink">{discloseState.crisis}</p>
      </Card>
    );
  }

  if (discloseState.ok) {
    return (
      <Card tone="sage" className="p-8">
        <Eyebrow>Sent</Eyebrow>
        <p className="mt-4 font-serif text-2xl">{allyName} has been told that you came forward yourself.</p>
      </Card>
    );
  }

  if (contestState.ok) {
    return (
      <Card tone="amber" className="p-8">
        <Eyebrow>Contested</Eyebrow>
        <p className="mt-4 text-sm text-muted">
          {allyName} has been told this was flagged and that you say it was a false positive. It stays on the
          record, labelled as contested.
        </p>
      </Card>
    );
  }

  return (
    <Card tone="steel" className="p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <Eyebrow>Something was flagged</Eyebrow>
        <span className="font-mono text-2xl tabular-nums text-steel" aria-live="off">
          {text || "—:—"}
        </span>
      </div>

      <h2 className="mt-5 font-serif text-3xl">Do you want to tell him yourself?</h2>

      <p className="mt-4 text-sm text-muted">
        {EVENT_CATEGORY_LABELS[category]} at {clock}. Nothing has been sent to {allyName}.
        {expired ? " The window has closed." : " He will not know unless you tell him, or the window lapses."}
      </p>

      <form action={disclose} className="mt-8 space-y-4">
        <input type="hidden" name="eventId" value={eventId} />
        <textarea
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={DISCLOSURE_NOTE_MAX_LENGTH}
          rows={4}
          placeholder="In your own words. He will read exactly this."
          className="w-full border border-border bg-bg px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-steel"
        />

        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton tone="primary">Tell him yourself</SubmitButton>
          <button
            type="button"
            onClick={askElerii}
            disabled={drafting}
            className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
          >
            {drafting ? "Ẹlẹ́rìí is writing" : "Ask Ẹlẹ́rìí for words"}
          </button>
          <span className="ml-auto text-xs text-muted">
            {note.length}/{DISCLOSURE_NOTE_MAX_LENGTH}
          </span>
        </div>

        {draftError && <p className="text-xs text-muted">{draftError}</p>}
        {discloseState.error && <Notice tone="alert">{discloseState.error}</Notice>}
      </form>

      <div className="mt-8 border-t border-border pt-6">
        {!showContest ? (
          <button
            type="button"
            onClick={() => setShowContest(true)}
            className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            This was a false positive.
          </button>
        ) : (
          <form action={contest} className="space-y-4">
            <input type="hidden" name="eventId" value={eventId} />
            <p className="text-sm text-muted">
              Contesting does not remove this. {allyName} is still told it was flagged, labelled as contested.
              There is no button here that makes an event disappear.
            </p>
            <textarea
              name="note"
              maxLength={DISCLOSURE_NOTE_MAX_LENGTH}
              rows={2}
              placeholder="Optional — what he should know about it."
              className="w-full border border-border bg-bg px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-steel"
            />
            {contestState.error && <Notice tone="alert">{contestState.error}</Notice>}
            <div className="flex gap-4">
              <SubmitButton tone="ghost">Mark as contested</SubmitButton>
              <button
                type="button"
                onClick={() => setShowContest(false)}
                className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
