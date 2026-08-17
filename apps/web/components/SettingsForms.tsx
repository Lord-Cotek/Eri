"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { GRACE_WINDOW_MAX_MINUTES, GRACE_WINDOW_MIN_MINUTES } from "@eri/protocol";

import { revokeCovenantAction, setGraceWindowAction, type ActionState } from "@/app/actions/covenant";
import { Field, Notice, inputClass } from "@/components/ui";

function Submit({ children, tone }: { children: React.ReactNode; tone: "primary" | "danger" }) {
  const { pending } = useFormStatus();
  const cls =
    tone === "primary"
      ? "border border-steel text-steel hover:bg-steel hover:text-bg"
      : "border border-alert/50 text-alert hover:bg-alert hover:text-bg";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center px-5 py-2.5 text-sm transition-colors duration-200 ease-editorial disabled:opacity-40 ${cls}`}
    >
      {pending ? "Working" : children}
    </button>
  );
}

export function GraceWindowForm({ current, allyName }: { current: number; allyName: string }) {
  const [state, action] = useFormState<ActionState, FormData>(setGraceWindowAction, {});
  const [value, setValue] = useState(current);

  return (
    <form action={action} className="max-w-prose space-y-6">
      <Field
        label="Grace window"
        hint={`How long you get to speak first. ${GRACE_WINDOW_MIN_MINUTES}–${GRACE_WINDOW_MAX_MINUTES} minutes.`}
      >
        <div className="flex items-center gap-4">
          <input
            type="range"
            name="graceWindowMinutes"
            min={GRACE_WINDOW_MIN_MINUTES}
            max={GRACE_WINDOW_MAX_MINUTES}
            step={5}
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
            className="flex-1 accent-[color:var(--steel)]"
          />
          <span className="w-24 font-mono text-sm tabular-nums text-steel">{value} min</span>
        </div>
      </Field>

      <p className="text-xs text-muted">
        {allyName} is told when you change this. A shorter window is not a stricter covenant — it is less time
        to find the words.
      </p>

      {state.error && <Notice tone="alert">{state.error}</Notice>}
      {state.ok && <p className="text-xs text-sage">Saved. {allyName} has been told.</p>}

      <Submit tone="primary">Save</Submit>
    </form>
  );
}

/**
 * Ending the covenant.
 *
 * The notification is stated in full *before* the button, not in a toast after
 * it. Consent is revocable but never silently, and a man is entitled to know
 * exactly what pressing this does before he presses it.
 */
export function RevokeForm({ covenantId, allyName }: { covenantId: string; allyName: string }) {
  const [state, action] = useFormState<ActionState, FormData>(revokeCovenantAction, {});
  const [open, setOpen] = useState(false);

  if (state.ok) {
    return (
      <Notice tone="alert">
        The covenant has ended. {allyName} was told immediately, and it is permanently marked as ended by you.
      </Notice>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-muted underline-offset-4 hover:text-alert hover:underline"
      >
        End this covenant
      </button>
    );
  }

  return (
    <form action={action} className="max-w-prose space-y-5 border border-alert/40 p-6">
      <input type="hidden" name="covenantId" value={covenantId} />

      <p className="text-sm text-ink">Before you do this, here is exactly what happens.</p>
      <ul className="space-y-2 text-sm text-muted">
        <li>— {allyName} is notified immediately. Not tomorrow, not in a digest. Immediately.</li>
        <li>— The covenant is permanently marked as ended by you. That mark does not come off.</li>
        <li>— Your devices are retired and stop reporting.</li>
        <li>— Nothing already recorded is deleted. Events are never deleted.</li>
      </ul>
      <p className="text-sm text-muted">
        You are within your rights to do this at any time, for any reason, and you do not owe anyone an
        explanation. Being told is the one condition.
      </p>

      <Field label='Type "END IT" to confirm'>
        <input type="text" name="confirm" autoComplete="off" className={inputClass} />
      </Field>

      {state.error && <Notice tone="alert">{state.error}</Notice>}

      <div className="flex flex-wrap items-center gap-4">
        <Submit tone="danger">End the covenant and tell {allyName}</Submit>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Keep it
        </button>
      </div>
    </form>
  );
}
