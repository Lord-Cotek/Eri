import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CovenantForm } from "@/components/CovenantForm";
import { Markdown } from "@/components/Markdown";
import { Shell } from "@/components/Shell";
import { Eyebrow } from "@/components/ui";
import { currentUserId } from "@/lib/auth";
import { TERMS_VERSION, covenantTerms, subjectCovenant } from "@/lib/covenant";

export const metadata: Metadata = { title: "Start a covenant", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewCovenant() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?callbackUrl=/covenant/new");

  const existing = await subjectCovenant(userId);
  if (existing) redirect("/subject");

  return (
    <Shell>
      <div className="rise max-w-prose">
        <Eyebrow>The covenant</Eyebrow>
        <h1 className="mt-5 font-serif text-3xl">You are signing this for yourself.</h1>
        <p className="mt-4 text-sm text-muted">
          You are the subject: the man installing this on his own devices. Name the man you are asking to be
          your ally. He reads the same terms and signs them himself — nothing starts until he does.
        </p>
      </div>

      <section id="terms" className="mt-12 border-t border-border pt-10">
        <Eyebrow>Terms · version {TERMS_VERSION}</Eyebrow>
        <div className="mt-6 max-h-[28rem] overflow-y-auto border border-border bg-surface p-6">
          <Markdown source={covenantTerms()} />
        </div>
      </section>

      <section className="mt-10 border-t border-border pt-10">
        <CovenantForm />
      </section>
    </Shell>
  );
}
