"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { Button, inputClass } from "@/components/ui";

export function SignInForm({ callbackUrl = "/subject" }: { callbackUrl?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email || busy) return;
    setBusy(true);
    await signIn("email", { email, redirect: false, callbackUrl });
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <p className="text-sm text-muted">
        A sign-in link is on its way to <span className="text-ink">{email}</span>.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && submit()}
        placeholder="you@example.com"
        aria-label="Email address"
        className={inputClass}
      />
      <Button onClick={submit} disabled={busy} className="w-full">
        {busy ? "Sending" : "Send a sign-in link"}
      </Button>
    </div>
  );
}

export function SignOutButton() {
  return (
    <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
      Sign out
    </Button>
  );
}
