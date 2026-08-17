"use client";

import { useState } from "react";
import { ANTECEDENT_KINDS, EVENT_CATEGORIES, type AntecedentKind, type EventCategory } from "@eri/protocol";

import { Button, Card, Eyebrow, Field, inputClass } from "@/components/ui";

/**
 * The buttons behind /simulator.
 *
 * Every one of them goes through the real signed endpoints. There is no
 * shortcut into the database here — a demo that wrote rows directly would prove
 * the UI works and nothing about the protocol.
 */

type LogLine = { at: string; text: string; bad?: boolean };

export function SimulatorPanel({ initialDevices }: { initialDevices: string[] }) {
  const [devices, setDevices] = useState<string[]>(initialDevices);
  const [deviceId, setDeviceId] = useState<string>(initialDevices[0] ?? "");
  const [pairingCode, setPairingCode] = useState("");
  const [category, setCategory] = useState<EventCategory>("EXPLICIT_IMAGE");
  const [at, setAt] = useState("01:14");
  const [antecedent, setAntecedent] = useState<AntecedentKind>("LATE_HOUR");
  const [log, setLog] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);

  function say(text: string, bad = false) {
    setLog((lines) => [{ at: new Date().toLocaleTimeString("en-GB"), text, bad }, ...lines].slice(0, 40));
  }

  async function call(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(true);
    try {
      const response = await fetch("/api/dev/simulator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        say(String(data.error ?? "Failed"), true);
        return null;
      }
      return data;
    } catch (error) {
      say(error instanceof Error ? error.message : "Failed", true);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        {/* ── Register ───────────────────────────────────────────── */}
        <Card className="p-6">
          <Eyebrow>Register a simulated device</Eyebrow>
          <p className="mt-3 text-xs text-muted">
            Mint a pairing code on /devices first. A fresh Ed25519 keypair is generated and written to{" "}
            <span className="font-mono">.eri-sim/</span> — the same store the CLI uses, so{" "}
            <span className="font-mono">eri-sim run --device web-…</span> can pick this device up and keep it
            heartbeating.
          </p>
          <div className="mt-5 space-y-4">
            <Field label="Pairing code">
              <input
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value.toUpperCase())}
                placeholder="ABC12345"
                className={`${inputClass} font-mono tracking-[0.2em]`}
              />
            </Field>
            <Button
              disabled={busy || pairingCode.length < 6}
              onClick={async () => {
                const data = await call({ action: "register", pairingCode, label: "Browser simulator" });
                if (!data) return;
                const id = String(data.deviceId);
                setDevices(Array.isArray(data.devices) ? (data.devices as string[]) : [id]);
                setDeviceId(id);
                setPairingCode("");
                say(`Registered device ${id}`);
              }}
            >
              Register
            </Button>
          </div>
        </Card>

        {/* ── Act as the device ──────────────────────────────────── */}
        <Card className="p-6">
          <Eyebrow>Act as the device</Eyebrow>

          <div className="mt-5 space-y-4">
            <Field label="Device">
              <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className={inputClass}>
                {devices.length === 0 && <option value="">No registered device</option>}
                {devices.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EventCategory)}
                  className={inputClass}
                >
                  {EVENT_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="At (HH:MM)">
                <input value={at} onChange={(e) => setAt(e.target.value)} className={inputClass} />
              </Field>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={busy || !deviceId}
                onClick={async () => {
                  const data = await call({ action: "fire", deviceId, category, at });
                  if (data) say(`Fired ${category} — pending until ${String(data.windowExpiresAt)}`);
                }}
              >
                Fire an event
              </Button>

              <Button
                variant="ghost"
                disabled={busy || !deviceId}
                onClick={async () => {
                  const data = await call({ action: "heartbeat", deviceId });
                  if (data) say(`Heartbeat ok — covenant ${data.covenantActive ? "active" : "ended"}`);
                }}
              >
                Heartbeat
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <Field label="Antecedent">
                  <select
                    value={antecedent}
                    onChange={(e) => setAntecedent(e.target.value as AntecedentKind)}
                    className={inputClass}
                  >
                    {ANTECEDENT_KINDS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Button
                variant="ghost"
                disabled={busy || !deviceId}
                onClick={async () => {
                  const data = await call({ action: "antecedent", deviceId, kind: antecedent });
                  if (data) say(`Antecedent ${antecedent}`);
                }}
              >
                Send
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Time ───────────────────────────────────────────────── */}
        <Card className="p-6">
          <Eyebrow>Move time along</Eyebrow>
          <p className="mt-3 text-xs text-muted">
            Runs the same functions the cron sweep does, so a window can be watched lapsing without waiting ten
            minutes. To prove silence detection, stop heartbeating (or run{" "}
            <span className="font-mono">eri-sim go-dark --for 8h</span>) and sweep after the threshold.
          </p>
          <div className="mt-5">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                const data = await call({ action: "sweep" });
                if (!data) return;
                const silence = data.silence as { opened: number; allyNotified: number } | undefined;
                say(
                  `Swept — ${data.lapsed} lapsed · ${silence?.opened ?? 0} silences opened · ` +
                    `${silence?.allyNotified ?? 0} allies alerted · ${data.digests} digests`,
                );
              }}
            >
              Run the sweep now
            </Button>
          </div>
        </Card>
      </div>

      {/* ── Log ──────────────────────────────────────────────────── */}
      <aside>
        <Eyebrow>Log</Eyebrow>
        <div className="mt-4 max-h-[36rem] overflow-y-auto border border-border bg-bg p-4 font-mono text-xs">
          {log.length === 0 ? (
            <p className="text-muted">Nothing yet.</p>
          ) : (
            <ul className="space-y-2">
              {log.map((line, index) => (
                <li key={index} className={line.bad ? "text-alert" : "text-muted"}>
                  <span className="text-muted/60">{line.at}</span> {line.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
