"use client";

import { useFormState, useFormStatus } from "react-dom";

import { stillHereAction } from "@/app/actions/ally";
import type { ActionState } from "@/app/actions/covenant";

/**
 * The whole of the ally's reply surface.
 *
 * One tap, one sentence, sent verbatim. There is no text box here on purpose:
 * an ally who wants to say more should say it to his face, and a comment field
 * would let a man feel he had done the work by typing.
 */
function Inner({ acknowledged }: { acknowledged: boolean }) {
  const { pending } = useFormStatus();
  if (acknowledged) return <span className="text-xs text-sage">You told him you are still here.</span>;
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs text-muted underline-offset-4 transition-colors hover:text-steel hover:underline disabled:opacity-40"
    >
      {pending ? "Sending" : "I saw it. I'm still here."}
    </button>
  );
}

export function StillHereButton({
  eventId,
  digestId,
  acknowledged = false,
}: {
  eventId?: string;
  digestId?: string;
  acknowledged?: boolean;
}) {
  const [state, action] = useFormState<ActionState, FormData>(stillHereAction, {});

  return (
    <form action={action}>
      {eventId && <input type="hidden" name="eventId" value={eventId} />}
      {digestId && <input type="hidden" name="digestId" value={digestId} />}
      <Inner acknowledged={acknowledged || Boolean(state.ok)} />
      {state.error && <p className="mt-1 text-xs text-alert">{state.error}</p>}
    </form>
  );
}
