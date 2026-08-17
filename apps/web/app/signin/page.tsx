import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "@/components/SignInForm";
import { EriMark } from "@/components/ui/EriMark";
import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignIn({ searchParams }: { searchParams: { sent?: string; callbackUrl?: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rise">
        <Link href="/" className="inline-flex items-center gap-3 text-muted transition-colors hover:text-ink">
          <EriMark size={20} className="text-steel" />
          <Eyebrow>Ẹ̀rí</Eyebrow>
        </Link>

        {searchParams.sent ? (
          <>
            <h1 className="mt-10 font-serif text-3xl">Check your inbox.</h1>
            <p className="mt-4 text-sm text-muted">
              A sign-in link has been sent. It is good once, and it expires.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-10 font-serif text-3xl">Sign in.</h1>
            <p className="mt-4 text-sm text-muted">
              No password. A link arrives by email and signs you in.
            </p>
            <div className="mt-10">
              <SignInForm callbackUrl={searchParams.callbackUrl ?? "/subject"} />
            </div>
          </>
        )}

        <p className="mt-10 text-xs text-muted">
          Ẹ̀rí is for two consenting adults. Nobody may install it on anyone else.
        </p>
      </div>
    </main>
  );
}
