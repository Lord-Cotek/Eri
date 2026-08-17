import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Shell } from "@/components/Shell";
import { SimulatorPanel } from "@/components/SimulatorPanel";
import { Eyebrow } from "@/components/ui";
import { currentUserId } from "@/lib/auth";
import { simDevices, simulatorEnabled } from "@/lib/dev-simulator";

export const metadata: Metadata = { title: "Simulator", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The simulated sentinel, without a terminal.
 *
 * Blocked in production by `notFound()` rather than a message, so a production
 * deployment does not advertise that this route exists.
 */
export default async function SimulatorPage() {
  if (!simulatorEnabled()) notFound();

  const userId = await currentUserId();
  if (!userId) redirect("/signin?callbackUrl=/simulator");

  return (
    <Shell active="/simulator" showSimulator>
      <div className="rise space-y-10">
        <section className="max-w-prose">
          <Eyebrow>Development only</Eyebrow>
          <h1 className="mt-5 font-serif text-3xl">The simulated sentinel.</h1>
          <p className="mt-4 text-sm text-muted">
            These buttons are a client of the public wire protocol, not a test hook. Each one generates a real
            Ed25519 signature and posts it to the same endpoint an iPhone will. If a button works here, the
            protocol works.
          </p>
          <p className="mt-4 text-sm text-muted">
            The CLI does the same and more —{" "}
            <span className="font-mono text-xs">npx eri-sim run --profile realistic</span> and{" "}
            <span className="font-mono text-xs">npx eri-sim go-dark --for 8h</span>.
          </p>
        </section>

        <SimulatorPanel initialDevices={simDevices()} />
      </div>
    </Shell>
  );
}
