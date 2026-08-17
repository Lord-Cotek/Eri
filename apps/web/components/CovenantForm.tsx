"use client";

import { useFormState, useFormStatus } from "react-dom";
import { GRACE_WINDOW_DEFAULT_MINUTES, GRACE_WINDOW_MAX_MINUTES, GRACE_WINDOW_MIN_MINUTES } from "@eri/protocol";

import { createCovenantAction, type ActionState } from "@/app/actions/covenant";
import { Field, Notice, inputClass } from "@/components/ui";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center border border-steel px-5 py-2.5 text-sm text-steel transition-colors duration-200 ease-editorial hover:bg-steel hover:text-bg disabled:opacity-40"
    >
      {pending ? "Working" : children}
    </button>
  );
}

export function CovenantForm() {
  const [state, action] = useFormState<ActionState, FormData>(createCovenantAction, {});

  return (
    <form action={action} className="max-w-prose space-y-8">
      <Field label="Your ally's email" hint="He must have an Ẹ̀rí account, or he can make one from the link.">
        <input type="email" name="allyEmail" required placeholder="him@example.com" className={inputClass} />
      </Field>

      <Field
        label="Grace window"
        hint={`How long you get to speak first, in minutes. ${GRACE_WINDOW_MIN_MINUTES}–${GRACE_WINDOW_MAX_MINUTES}. You can change it later, and he is told when you do.`}
      >
        <input
          type="number"
          name="graceWindowMinutes"
          min={GRACE_WINDOW_MIN_MINUTES}
          max={GRACE_WINDOW_MAX_MINUTES}
          defaultValue={GRACE_WINDOW_DEFAULT_MINUTES}
          className={inputClass}
        />
      </Field>

      <label className="flex max-w-prose items-start gap-3 text-sm text-muted">
        <input type="checkbox" name="agree" className="mt-1 accent-[color:var(--steel)]" />
        <span>
          I am over 18, I am entering this freely, and I have read the terms above. I understand that ending
          this covenant will notify my ally immediately.
        </span>
      </label>

      {state.error && <Notice tone="alert">{state.error}</Notice>}

      <Submit>Sign and send the invitation</Submit>
    </form>
  );
}
