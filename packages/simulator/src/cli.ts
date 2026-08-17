#!/usr/bin/env node
/**
 * eri-sim — the simulated sentinel.
 *
 * This is not a test fixture. It is a first-class client of the public wire
 * protocol: it generates its own Ed25519 keypair, signs every request, and
 * talks to the same endpoints the Swift and Kotlin sentinels will. If something
 * works here and not on a phone, the phone is wrong.
 *
 *   eri-sim register --pairing-code ABC123
 *   eri-sim run --profile realistic
 *   eri-sim fire --category EXPLICIT_IMAGE --at 01:14
 *   eri-sim go-dark --for 8h
 */

import {
  ANTECEDENT_KINDS,
  EVENT_CATEGORIES,
  HEARTBEAT_INTERVAL_MINUTES,
  type AntecedentKind,
  type EventCategory,
} from "@eri/protocol";
import { SentinelClient, ProtocolRequestError } from "@eri/protocol/client";
import { generateDeviceKeyPair } from "@eri/protocol/signing";

import { bool, num, parseArgs, parseDuration, parseWallClock, requireStr, str } from "./args.js";
import { PROFILES, PROFILE_NAMES, isProfileName, perTickProbability, weightedPick } from "./profiles.js";
import { deviceExists, listDevices, loadDevice, patchDevice, saveDevice, storeDir, type DeviceRecord } from "./store.js";

const SENTINEL_VERSION = "sim-0.1.0";
const CLASSIFIER_VERSION = "sim-classifier-0.1.0";
const DEFAULT_BASE_URL = process.env.ERI_BASE_URL ?? "http://localhost:3000";
const DEFAULT_DEVICE = "default";

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

const dim = (s: string) => `[2m${s}[0m`;
const bold = (s: string) => `[1m${s}[0m`;

function stamp(): string {
  return dim(new Date().toISOString().slice(11, 19));
}

function say(message: string): void {
  process.stdout.write(`${stamp()}  ${message}\n`);
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

function clientFor(device: DeviceRecord): SentinelClient {
  return new SentinelClient({
    baseUrl: device.baseUrl,
    privateKey: device.privateKey,
    deviceId: device.deviceId,
    sentinelVersion: SENTINEL_VERSION,
    classifierVersion: CLASSIFIER_VERSION,
  });
}

/* ------------------------------------------------------------------ */
/* register                                                            */
/* ------------------------------------------------------------------ */

async function cmdRegister(flags: Record<string, string | true>): Promise<void> {
  const name = str(flags, "device") ?? DEFAULT_DEVICE;
  const baseUrl = str(flags, "base-url") ?? DEFAULT_BASE_URL;
  const pairing = requireStr(flags, "pairing-code").toUpperCase();
  const label = str(flags, "label") ?? "Simulated device";

  if (deviceExists(name) && !bool(flags, "force")) {
    throw new Error(`A simulated device called "${name}" already exists. Pass --force to replace it.`);
  }

  // The keypair is made here and the private half never leaves this machine.
  // On a phone this is the Secure Enclave / Keystore call.
  const keys = generateDeviceKeyPair();

  const client = new SentinelClient({
    baseUrl,
    privateKey: keys.privateKey,
    sentinelVersion: SENTINEL_VERSION,
    classifierVersion: CLASSIFIER_VERSION,
  });

  const response = await client.register({
    pairingCode: pairing,
    publicKey: keys.publicKey,
    platform: "SIMULATOR",
    label,
  });

  saveDevice({
    name,
    baseUrl,
    deviceId: response.deviceId,
    covenantId: response.covenantId,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    platform: "SIMULATOR",
    label,
    graceWindowMinutes: response.graceWindowMinutes,
    heartbeatIntervalMinutes: response.heartbeatIntervalMinutes,
    registeredAt: new Date().toISOString(),
  });

  say(`Registered ${bold(name)} as device ${response.deviceId}`);
  say(`Grace window ${response.graceWindowMinutes} min · heartbeat every ${response.heartbeatIntervalMinutes} min`);
  say(dim(`Keys stored in ${storeDir()}`));
}

/* ------------------------------------------------------------------ */
/* fire                                                                */
/* ------------------------------------------------------------------ */

function parseCategory(value: string): EventCategory {
  const upper = value.toUpperCase() as EventCategory;
  if (!(EVENT_CATEGORIES as readonly string[]).includes(upper)) {
    throw new Error(`Unknown category "${value}". One of: ${EVENT_CATEGORIES.join(", ")}`);
  }
  return upper;
}

async function cmdFire(flags: Record<string, string | true>): Promise<void> {
  const device = loadDevice(str(flags, "device") ?? DEFAULT_DEVICE);
  const category = parseCategory(str(flags, "category") ?? "EXPLICIT_IMAGE");
  const at = str(flags, "at");
  const occurredAt = at ? parseWallClock(at) : new Date();
  const confidence = num(flags, "confidence") ?? 0.82;

  const response = await clientFor(device).event({ category, confidence, occurredAt });

  say(`Fired ${bold(category)} at ${occurredAt.toISOString()}`);
  say(`Event ${response.eventId} is PENDING until ${response.windowExpiresAt}`);
  say(dim("Only the subject has been told. The ally sees nothing until this resolves."));
}

/* ------------------------------------------------------------------ */
/* antecedent                                                          */
/* ------------------------------------------------------------------ */

async function cmdAntecedent(flags: Record<string, string | true>): Promise<void> {
  const device = loadDevice(str(flags, "device") ?? DEFAULT_DEVICE);
  const raw = (str(flags, "kind") ?? "LATE_HOUR").toUpperCase() as AntecedentKind;
  if (!(ANTECEDENT_KINDS as readonly string[]).includes(raw)) {
    throw new Error(`Unknown antecedent "${raw}". One of: ${ANTECEDENT_KINDS.join(", ")}`);
  }
  const at = str(flags, "at");
  const occurredAt = at ? parseWallClock(at) : new Date();

  await clientFor(device).antecedent({ antecedent: raw, occurredAt });
  say(`Antecedent ${bold(raw)} at ${occurredAt.toISOString()}`);
}

/* ------------------------------------------------------------------ */
/* heartbeat                                                           */
/* ------------------------------------------------------------------ */

async function cmdHeartbeat(flags: Record<string, string | true>): Promise<void> {
  const name = str(flags, "device") ?? DEFAULT_DEVICE;
  const device = loadDevice(name);
  const response = await clientFor(device).heartbeat();
  patchDevice(name, {
    graceWindowMinutes: response.graceWindowMinutes,
    heartbeatIntervalMinutes: response.heartbeatIntervalMinutes,
  });
  say(`Heartbeat ok · grace ${response.graceWindowMinutes} min · covenant ${response.covenantActive ? "active" : "ended"}`);
}

/* ------------------------------------------------------------------ */
/* go-dark                                                             */
/* ------------------------------------------------------------------ */

async function cmdGoDark(flags: Record<string, string | true>): Promise<void> {
  const name = str(flags, "device") ?? DEFAULT_DEVICE;
  const forFlag = str(flags, "for") ?? "8h";
  const until = new Date(Date.now() + parseDuration(forFlag));

  patchDevice(name, { darkUntil: until.toISOString() });

  say(`${bold(name)} is dark until ${until.toISOString()}`);
  say(dim("No heartbeats will be sent. The sweep job will open a Silence record:"));
  say(dim("  WARNING after 60 minutes · ALERT after 6 hours, and the ally is told."));
  say(dim("You cannot make an app un-uninstallable. You can make its absence reportable."));
}

async function cmdComeBack(flags: Record<string, string | true>): Promise<void> {
  const name = str(flags, "device") ?? DEFAULT_DEVICE;
  patchDevice(name, { darkUntil: undefined });
  say(`${bold(name)} is heartbeating again.`);
}

/* ------------------------------------------------------------------ */
/* run                                                                 */
/* ------------------------------------------------------------------ */

async function cmdRun(flags: Record<string, string | true>): Promise<void> {
  const name = str(flags, "device") ?? DEFAULT_DEVICE;
  const profileName = str(flags, "profile") ?? "realistic";
  if (!isProfileName(profileName)) {
    throw new Error(`Unknown profile "${profileName}". One of: ${PROFILE_NAMES.join(", ")}`);
  }
  const profile = PROFILES[profileName];

  // `--speed 60` runs an hour of simulated time per minute, so a week of
  // rhythm can be watched over a coffee.
  const speed = num(flags, "speed") ?? 1;
  if (speed <= 0) throw new Error("--speed must be greater than zero");

  const initial = loadDevice(name);
  const tickMinutes = initial.heartbeatIntervalMinutes || HEARTBEAT_INTERVAL_MINUTES;
  const tickMs = (tickMinutes * 60_000) / speed;

  const eventChance = perTickProbability(profile.eventsPerWeek, profile, tickMinutes);
  const antecedentChance = perTickProbability(profile.antecedentsPerWeek, profile, tickMinutes);

  say(`Running ${bold(name)} on profile ${bold(profile.name)} — ${profile.description}`);
  say(dim(`Tick every ${(tickMs / 1000).toFixed(0)}s (${tickMinutes} simulated minutes at ${speed}×). Ctrl-C to stop.`));

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
    say("Stopping.");
  });

  while (!stopping) {
    // Reloaded each tick so `go-dark` and grace-window changes are picked up
    // by a running loop without restarting it.
    const device = loadDevice(name);
    const client = clientFor(device);
    const now = new Date();
    const dark = device.darkUntil ? new Date(device.darkUntil) > now : false;

    if (dark) {
      say(dim(`dark — no heartbeat (until ${device.darkUntil})`));
    } else if (Math.random() < profile.heartbeatDropRate) {
      say(dim("heartbeat dropped"));
    } else {
      try {
        const response = await client.heartbeat();
        if (!response.covenantActive) {
          say("The covenant has ended. A real sentinel would uninstall itself here.");
          return;
        }
        if (response.graceWindowMinutes !== device.graceWindowMinutes) {
          patchDevice(name, { graceWindowMinutes: response.graceWindowMinutes });
          say(`Grace window is now ${response.graceWindowMinutes} minutes.`);
        }
      } catch (error) {
        say(dim(`heartbeat failed — ${describe(error)}`));
      }
    }

    const inActiveHour = profile.activeHours.includes(now.getHours());

    if (!dark && inActiveHour && Object.keys(profile.antecedentWeights).length > 0) {
      if (Math.random() < antecedentChance) {
        const kind = weightedPick(profile.antecedentWeights);
        try {
          await client.antecedent({ antecedent: kind, occurredAt: now });
          say(`antecedent ${kind}`);
        } catch (error) {
          say(dim(`antecedent failed — ${describe(error)}`));
        }
      }
    }

    if (!dark && inActiveHour && Object.keys(profile.categoryWeights).length > 0) {
      if (Math.random() < eventChance) {
        const category = weightedPick(profile.categoryWeights);
        const confidence = Number((0.6 + Math.random() * 0.39).toFixed(2));
        try {
          const response = await client.event({ category, confidence, occurredAt: now });
          say(`event ${bold(category)} · confidence ${confidence} · pending until ${response.windowExpiresAt}`);
        } catch (error) {
          say(dim(`event failed — ${describe(error)}`));
        }
      }
    }

    await sleep(tickMs);
  }
}

/* ------------------------------------------------------------------ */
/* status                                                              */
/* ------------------------------------------------------------------ */

function cmdStatus(flags: Record<string, string | true>): void {
  const names = listDevices();
  if (names.length === 0) {
    say("No simulated devices. Register one with: eri-sim register --pairing-code <CODE>");
    return;
  }
  const only = str(flags, "device");
  for (const name of names) {
    if (only && only !== name) continue;
    const device = loadDevice(name);
    const dark = device.darkUntil && new Date(device.darkUntil) > new Date();
    say(
      `${bold(name)} · ${device.deviceId} · ${device.baseUrl} · grace ${device.graceWindowMinutes}m` +
        (dark ? ` · ${bold("DARK")} until ${device.darkUntil}` : ""),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Plumbing                                                            */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describe(error: unknown): string {
  if (error instanceof ProtocolRequestError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

const HELP = `
Ẹ̀rí — simulated sentinel

  eri-sim register --pairing-code ABC123 [--base-url URL] [--label "iPhone"] [--device NAME]
  eri-sim run --profile realistic [--speed 60] [--device NAME]
  eri-sim fire --category EXPLICIT_IMAGE [--at 01:14] [--confidence 0.82]
  eri-sim antecedent --kind LATE_HOUR [--at 01:14]
  eri-sim heartbeat
  eri-sim go-dark --for 8h
  eri-sim come-back
  eri-sim status

Profiles   ${PROFILE_NAMES.join(" · ")}
Categories ${EVENT_CATEGORIES.join(" · ")}

The base URL defaults to ERI_BASE_URL or http://localhost:3000.
Device keys are stored in ${storeDir()} and never transmitted.
`;

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "register":
      return cmdRegister(flags);
    case "run":
      return cmdRun(flags);
    case "fire":
      return cmdFire(flags);
    case "antecedent":
      return cmdAntecedent(flags);
    case "heartbeat":
      return cmdHeartbeat(flags);
    case "go-dark":
      return cmdGoDark(flags);
    case "come-back":
      return cmdComeBack(flags);
    case "status":
      return cmdStatus(flags);
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(`${HELP}\n`);
      return;
    default:
      process.stdout.write(`Unknown command "${command}".\n${HELP}\n`);
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${describe(error)}\n\n`);
  process.exitCode = 1;
});
