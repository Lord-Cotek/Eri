"use client";

import { useFormState, useFormStatus } from "react-dom";

import { issuePairingCodeAction, retireDeviceAction, type ActionState } from "@/app/actions/covenant";
import { Notice } from "@/components/ui";

function Submit({ children, variant = "primary" }: { children: string; variant?: "primary" | "quiet" }) {
  const { pending } = useFormStatus();
  if (variant === "quiet") {
    return (
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-muted underline-offset-4 hover:text-alert hover:underline disabled:opacity-40"
      >
        {pending ? "Working" : children}
      </button>
    );
  }
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

/**
 * Mint a pairing code.
 *
 * Shown once, here, in his own browser. Never emailed — an emailed pairing code
 * is a pairing code in somebody else's inbox.
 */
export function PairingCodeButton() {
  const [state, action] = useFormState<ActionState, FormData>(issuePairingCodeAction, {});

  return (
    <div className="space-y-4">
      <form action={action}>
        <Submit>Add a device</Submit>
      </form>

      {state.error && <Notice tone="alert">{state.error}</Notice>}

      {state.value && (
        <div className="border border-steel/40 bg-surface p-6">
          <p className="eyebrow">Pairing code</p>
          <p className="mt-3 select-all font-mono text-3xl tracking-[0.3em] text-steel">{state.value}</p>
          <p className="mt-4 text-xs text-muted">
            Good once, for fifteen minutes. Type it into the sentinel on the device itself:
          </p>
          <p className="mt-2 break-all font-mono text-xs text-muted">
            npx eri-sim register --pairing-code {state.value}
          </p>
        </div>
      )}
    </div>
  );
}

export function RetireDeviceButton({ deviceId }: { deviceId: string }) {
  const [state, action] = useFormState<ActionState, FormData>(retireDeviceAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="deviceId" value={deviceId} />
      <Submit variant="quiet">Retire this device</Submit>
      {state.error && <p className="mt-1 text-xs text-alert">{state.error}</p>}
    </form>
  );
}
