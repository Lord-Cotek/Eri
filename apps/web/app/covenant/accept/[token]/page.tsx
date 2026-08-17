import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AcceptForm } from "@/components/AcceptForm";
import { Markdown } from "@/components/Markdown";
import { Shell } from "@/components/Shell";
import { Eyebrow, Notice } from "@/components/ui";
import { currentUserId } from "@/lib/auth";
import { TERMS_VERSION, covenantTerms, displayName } from "@/lib/covenant";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "You have been asked to be an ally", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AcceptCovenant({ params }: { params: { token: string } }) {
  const userId = await currentUserId();
  if (!userId) redirect(`/signin?callbackUrl=/covenant/accept/${params.token}`);

  const covenant = await prisma.covenant.findUnique({
    where: { inviteToken: params.token },
    include: { subject: { select: { id: true, name: true, email: true } } },
  });

  if (!covenant) {
    return (
      <Shell>
        <Notice tone="alert">That invitation does not exist.</Notice>
      </Shell>
    );
  }

  const subject = displayName(covenant.subject);

  if (covenant.status !== "PENDING") {
    return (
      <Shell>
        <Eyebrow>Invitation</Eyebrow>
        <h1 className="mt-5 font-serif text-3xl">This has already been settled.</h1>
        <p className="mt-4 max-w-prose text-sm text-muted">Nothing further is needed from you.</p>
      </Shell>
    );
  }

  if (covenant.inviteExpiresAt < new Date()) {
    return (
      <Shell>
        <Eyebrow>Invitation</Eyebrow>
        <h1 className="mt-5 font-serif text-3xl">This invitation has expired.</h1>
        <p className="mt-4 max-w-prose text-sm text-muted">Ask {subject} to send a new one.</p>
      </Shell>
    );
  }

  if (covenant.subjectId === userId) {
    return (
      <Shell>
        <Notice tone="alert">A man cannot be his own ally.</Notice>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rise max-w-prose">
        <Eyebrow>You have been asked</Eyebrow>
        <h1 className="mt-5 font-serif text-3xl">{subject} has asked you to be his ally.</h1>
        <div className="mt-6 space-y-4 text-sm text-muted">
          <p>
            He installed this on himself and he chose you. Read the terms before you sign — being an ally asks
            something of you, and it is not nothing.
          </p>
          <p>
            You will be told when he came forward himself, when a window lapsed, and when a device goes quiet.
            You will get one question a week to bring him.{" "}
            <span className="text-ink">You will never be shown what he saw</span>, because nobody has it.
          </p>
          <p>
            You are not his counsellor and you are not responsible for his choices. You are a man who agreed to
            know, and to stay.
          </p>
        </div>
      </div>

      <section className="mt-12 border-t border-border pt-10">
        <Eyebrow>Terms · version {TERMS_VERSION}</Eyebrow>
        <div className="mt-6 max-h-[28rem] overflow-y-auto border border-border bg-surface p-6">
          <Markdown source={covenantTerms()} />
        </div>
      </section>

      <section className="mt-10 border-t border-border pt-10">
        <AcceptForm token={params.token} />
      </section>
    </Shell>
  );
}
