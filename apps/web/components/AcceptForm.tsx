"use client";

import { useFormState, useFormStatus } from "react-dom";

import { acceptCovenantAction, declineCovenantAction, type ActionState } from "@/app/actions/covenant";
import { Notice } from "@/components/ui";

function Submit({ children, variant }: { children: string; variant: "primary" | "ghost" }) {
  const { pending } = useFormStatus();
  const cls =
    variant === "primary"
      ? "border border-steel text-steel hover:bg-steel hover:text-bg"
      : "border border-border text-muted hover:border-ink hover:text-ink";
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

export function AcceptForm({ token }: { token: string }) {
  const [acceptState, accept] = useFormState<ActionState, FormData>(acceptCovenantAction, {});
  const [declineState, decline] = useFormState<ActionState, FormData>(declineCovenantAction, {});

  return (
    <div className="max-w-prose space-y-8">
      <form action={accept} className="space-y-6">
        <input type="hidden" name="token" value={token} />
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" name="agree" className="mt-1 accent-[color:var(--steel)]" />
          <span>
            I am over 18, I am agreeing to this freely, and I have read the terms. I will not use what I am told
            to shame him, and I will not repeat it to anyone.
          </span>
        </label>
        {acceptState.error && <Notice tone="alert">{acceptState.error}</Notice>}
        <Submit variant="primary">Sign and stand with him</Submit>
      </form>

      <div className="border-t border-border pt-8">
        <p className="text-sm text-muted">
          You may decline. He will be told that you did, and nothing else will happen.
        </p>
        <form action={decline} className="mt-4">
          <input type="hidden" name="token" value={token} />
          {declineState.error && <Notice tone="alert">{declineState.error}</Notice>}
          <Submit variant="ghost">Decline</Submit>
        </form>
      </div>
    </div>
  );
}
