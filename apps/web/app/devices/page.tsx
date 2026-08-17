import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HEARTBEAT_INTERVAL_MINUTES, SILENCE_ALERT_AFTER_MINUTES, SILENCE_WARNING_AFTER_MINUTES } from "@eri/protocol";

import { PairingCodeButton, RetireDeviceButton } from "@/components/DeviceControls";
import { Shell } from "@/components/Shell";
import { Card, Eyebrow, TONE_TEXT, type Tone } from "@/components/ui";
import { currentUserId } from "@/lib/auth";
import { subjectCovenant } from "@/lib/covenant";
import { devicesFor } from "@/lib/queries";
import { dayAndTime, humanDuration } from "@/lib/time";
import { simulatorEnabled } from "@/lib/dev-simulator";

export const metadata: Metadata = { title: "Devices", robots: { index: false } };
export const dynamic = "force-dynamic";

function heartbeatState(lastHeartbeatAt: Date | null, registeredAt: Date): { label: string; tone: Tone } {
  const since = Date.now() - (lastHeartbeatAt ?? registeredAt).getTime();
  const minutes = since / 60_000;
  if (minutes >= SILENCE_ALERT_AFTER_MINUTES) return { label: "Silent", tone: "alert" };
  if (minutes >= SILENCE_WARNING_AFTER_MINUTES) return { label: "Late", tone: "amber" };
  return { label: "Reporting", tone: "steel" };
}

export default async function DevicesPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/signin?callbackUrl=/devices");

  const covenant = await subjectCovenant(userId);
  const devices = await devicesFor(userId);

  return (
    <Shell active="/devices" showSimulator={simulatorEnabled()}>
      <div className="rise space-y-12">
        <section className="max-w-prose">
          <Eyebrow>Devices</Eyebrow>
          <h1 className="mt-5 font-serif text-3xl">Your devices, checking in.</h1>
          <p className="mt-4 text-sm text-muted">
            Each device reports every {HEARTBEAT_INTERVAL_MINUTES} minutes. After{" "}
            {SILENCE_WARNING_AFTER_MINUTES / 60} hour it is late, and that stays between you and this page.
            After {SILENCE_ALERT_AFTER_MINUTES / 60} hours it is silent, and your ally is told.
          </p>
          <p className="mt-4 text-sm text-muted">
            Ẹ̀rí cannot stop you uninstalling a sentinel and does not pretend to. It can only report that a
            device went quiet.
          </p>
        </section>

        <section>
          {devices.length === 0 ? (
            <Card className="p-8">
              <p className="text-sm text-muted">
                {covenant?.status === "ACTIVE"
                  ? "No devices yet. Mint a pairing code and register one."
                  : "Devices can be registered once your ally has signed."}
              </p>
            </Card>
          ) : (
            <ul className="divide-y divide-border border border-border">
              {devices.map((device) => {
                const state = heartbeatState(device.lastHeartbeatAt, device.registeredAt);
                const since = Date.now() - (device.lastHeartbeatAt ?? device.registeredAt).getTime();
                return (
                  <li key={device.id} className="px-6 py-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <span className="text-ink">{device.label}</span>
                      <span className={`text-xs uppercase tracking-[0.15em] ${TONE_TEXT[state.tone]}`}>
                        {state.label}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-muted">
                      {device.platform.toLowerCase()} · sentinel {device.sentinelVersion} · classifier{" "}
                      {device.classifierVersion}
                    </p>

                    <p className="mt-1 text-xs text-muted">
                      {device.lastHeartbeatAt
                        ? `Last reported ${humanDuration(since)} ago, at ${dayAndTime(device.lastHeartbeatAt)}.`
                        : `Registered ${dayAndTime(device.registeredAt)}. It has never reported.`}
                    </p>

                    {device.silences[0] && (
                      <p className="mt-3 border-l-2 border-alert/40 pl-4 text-xs text-alert">
                        Silent since {dayAndTime(device.silences[0].startedAt)} ({device.silences[0].severity.toLowerCase()}).
                      </p>
                    )}

                    <div className="mt-4">
                      <RetireDeviceButton deviceId={device.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {covenant?.status === "ACTIVE" && (
          <section className="border-t border-border pt-10">
            <Eyebrow>Register a device</Eyebrow>
            <p className="mt-3 max-w-prose text-sm text-muted">
              The code is shown once, here, and is good for fifteen minutes. It is never emailed — a pairing
              code in an inbox is a pairing code in somebody else&apos;s hands.
            </p>
            <div className="mt-6">
              <PairingCodeButton />
            </div>
          </section>
        )}
      </div>
    </Shell>
  );
}
