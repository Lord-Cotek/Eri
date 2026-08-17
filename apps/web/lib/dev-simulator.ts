/**
 * The browser-driven simulator, for demos without a terminal.
 *
 * It is the *same* client as the CLI: a real Ed25519 keypair, real signed
 * envelopes, real HTTP to the real endpoints over loopback. Nothing here takes
 * a shortcut into the database, because a shortcut would prove nothing.
 *
 * Keys are written to `.eri-sim/`, the same store `eri-sim` uses, so a device
 * registered in the browser can be picked up by the CLI — `eri-sim run --device
 * web-<id>` continues it. Module memory was tried first and is not durable
 * enough: Next re-evaluates route modules on recompilation, and a device
 * registered before a reload lost its key mid-demo.
 *
 * Writing private keys to disk is acceptable here for exactly one reason: this
 * module refuses to run in production, and `.eri-sim/` is gitignored.
 */

import "server-only";

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SentinelClient } from "@eri/protocol/client";
import { generateDeviceKeyPair } from "@eri/protocol/signing";
import { HEARTBEAT_INTERVAL_MINUTES, type AntecedentKind, type EventCategory } from "@eri/protocol";

export function simulatorEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function assertSimulatorEnabled(): void {
  if (!simulatorEnabled()) throw new Error("The simulator is not available in production.");
}

const SENTINEL_VERSION = "web-sim-0.1.0";
const CLASSIFIER_VERSION = "sim-classifier-0.1.0";

/** Matches `packages/simulator/src/store.ts` so the CLI can read what we write. */
type SimDeviceRecord = {
  name: string;
  baseUrl: string;
  deviceId: string;
  covenantId: string;
  publicKey: string;
  privateKey: string;
  platform: string;
  label: string;
  graceWindowMinutes: number;
  heartbeatIntervalMinutes: number;
  registeredAt: string;
};

function storeDir(): string {
  return resolve(process.env.ERI_SIM_HOME ?? join(process.cwd(), ".eri-sim"));
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function save(record: SimDeviceRecord): void {
  const dir = storeDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${record.name}.json`), `${JSON.stringify(record, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function allRecords(): SimDeviceRecord[] {
  const dir = storeDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => {
      try {
        return [JSON.parse(readFileSync(join(dir, file), "utf8")) as SimDeviceRecord];
      } catch {
        return [];
      }
    });
}

function keyFor(deviceId: string): SimDeviceRecord {
  const record = allRecords().find((candidate) => candidate.deviceId === deviceId);
  if (!record) {
    throw new Error(
      "No stored key for that device. Register one here, or with the CLI — the server never keeps device private keys anywhere but the simulator's own store.",
    );
  }
  return record;
}

function clientFor(record: SimDeviceRecord): SentinelClient {
  return new SentinelClient({
    baseUrl: baseUrl(),
    privateKey: record.privateKey,
    deviceId: record.deviceId,
    sentinelVersion: SENTINEL_VERSION,
    classifierVersion: CLASSIFIER_VERSION,
  });
}

export function simDevices(): string[] {
  return allRecords()
    .map((record) => record.deviceId)
    .sort();
}

export async function simRegister(input: { pairingCode: string; label: string }): Promise<{ deviceId: string }> {
  assertSimulatorEnabled();
  const keys = generateDeviceKeyPair();

  const client = new SentinelClient({
    baseUrl: baseUrl(),
    privateKey: keys.privateKey,
    sentinelVersion: SENTINEL_VERSION,
    classifierVersion: CLASSIFIER_VERSION,
  });

  const response = await client.register({
    pairingCode: input.pairingCode.toUpperCase(),
    publicKey: keys.publicKey,
    platform: "SIMULATOR",
    label: input.label,
  });

  save({
    name: `web-${response.deviceId.slice(-8)}`,
    baseUrl: baseUrl(),
    deviceId: response.deviceId,
    covenantId: response.covenantId,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    platform: "SIMULATOR",
    label: input.label,
    graceWindowMinutes: response.graceWindowMinutes,
    heartbeatIntervalMinutes: response.heartbeatIntervalMinutes || HEARTBEAT_INTERVAL_MINUTES,
    registeredAt: new Date().toISOString(),
  });

  return { deviceId: response.deviceId };
}

export async function simFire(input: {
  deviceId: string;
  category: EventCategory;
  confidence: number;
  occurredAt: Date;
}): Promise<{ eventId: string; windowExpiresAt: string }> {
  assertSimulatorEnabled();
  const response = await clientFor(keyFor(input.deviceId)).event({
    category: input.category,
    confidence: input.confidence,
    occurredAt: input.occurredAt,
  });
  return { eventId: response.eventId, windowExpiresAt: response.windowExpiresAt };
}

export async function simHeartbeat(deviceId: string): Promise<{ covenantActive: boolean }> {
  assertSimulatorEnabled();
  const response = await clientFor(keyFor(deviceId)).heartbeat();
  return { covenantActive: response.covenantActive };
}

export async function simAntecedent(input: { deviceId: string; kind: AntecedentKind }): Promise<void> {
  assertSimulatorEnabled();
  await clientFor(keyFor(input.deviceId)).antecedent({ antecedent: input.kind, occurredAt: new Date() });
}
