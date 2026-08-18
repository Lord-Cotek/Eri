"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { resendInviteAction, type ActionState } from "@/app/actions/covenant";
import { Notice } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center border border-steel px-5 py-2.5 text-sm text-steel transition-colors duration-200 ease-editorial hover:bg-steel hover:text-bg disabled:opacity-40"
    >
      {pending ? "Sending" : "Send it again"}
    </button>
  );
}

/**
 * What a man sees while he waits for his ally to sign.
 *
 * The invitation is the one moment in this product where somebody is waiting on
 * something he cannot see. So it says plainly who was asked, whether the email
 * actually went, and gives him the link to send himself — rather than leaving
 * him to guess whether silence means "not yet" or "never arrived".
 */
export function InvitePanel({
  covenantId,
  inviteEmail,
  inviteUrl,
  sent,
}: {
  covenantId: string;
  inviteEmail: string | null;
  inviteUrl: string;
  sent: boolean;
}) {
  const [state, action] = useFormState<ActionState, FormData>(resendInviteAction, {});
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link is on screen either way.
    }
  }

  return (
    <div className="space-y-8">
      {inviteEmail && (
        <div className="border border-border bg-surface p-6">
          <p className="eyebrow">Invited</p>
          <p className="mt-3 break-all text-ink">{inviteEmail}</p>
          <p className={`mt-3 text-xs ${sent ? "text-muted" : "text-amber"}`}>
            {sent
              ? "The invitation was emailed to him. It may take a minute, and it may land in spam."
              : "It could not be emailed. Send him the link below yourself — it works just as well."}
          </p>
        </div>
      )}

      <div>
        <p className="eyebrow">His link</p>
        <p className="mt-3 text-sm text-muted">
          Anyone with this link can accept. Send it to him, and to nobody else.
        </p>
        <p className="mt-4 break-all border border-border bg-surface p-4 text-xs text-steel">{inviteUrl}</p>

        <div className="mt-4 flex flex-wrap items-center gap-5">
          <button
            type="button"
            onClick={copy}
            className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {copied ? "Copied" : "Copy the link"}
          </button>

          {inviteEmail && (
            <form action={action}>
              <input type="hidden" name="covenantId" value={covenantId} />
              <Submit />
            </form>
          )}
        </div>

        {state.error && (
          <div className="mt-4">
            <Notice tone="amber">{state.error}</Notice>
          </div>
        )}
        {state.ok && <p className="mt-4 text-xs text-sage">Sent again.</p>}
      </div>
    </div>
  );
}
