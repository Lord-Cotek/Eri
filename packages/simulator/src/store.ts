/**
 * Where the simulated device keeps its identity.
 *
 * A real sentinel would put the private key in the Secure Enclave or the
 * Android Keystore. The simulator puts it in a file, which is exactly as
 * secure as it sounds — this is a development tool and the store lives in
 * `.eri-sim/`, which is gitignored.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type DeviceRecord = {
  name: string;
  baseUrl: string;
  deviceId: string;
  covenantId: string;
  publicKey: string;
  /** Raw Ed25519 seed. Never sent anywhere. */
  privateKey: string;
  platform: string;
  label: string;
  graceWindowMinutes: number;
  heartbeatIntervalMinutes: number;
  registeredAt: string;
  /**
   * Set by `go-dark`. While this is in the future the `run` loop suppresses
   * heartbeats, so the server's sweep job can open a Silence record. This is
   * the closest a simulator gets to a man deleting the app.
   */
  darkUntil?: string;
};

/** `ERI_SIM_HOME`, else `.eri-sim/` beside the repo, else `~/.eri-sim/`. */
export function storeDir(): string {
  const fromEnv = process.env.ERI_SIM_HOME;
  if (fromEnv) return resolve(fromEnv);
  const local = resolve(process.cwd(), ".eri-sim");
  if (existsSync(local)) return local;
  return join(homedir(), ".eri-sim");
}

function devicePath(name: string): string {
  return join(storeDir(), `${name}.json`);
}

export function saveDevice(record: DeviceRecord): void {
  const path = devicePath(record.name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function loadDevice(name: string): DeviceRecord {
  const path = devicePath(name);
  if (!existsSync(path)) {
    throw new Error(
      `No simulated device called "${name}". Register one first:\n  eri-sim register --pairing-code <CODE>`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as DeviceRecord;
}

export function deviceExists(name: string): boolean {
  return existsSync(devicePath(name));
}

export function listDevices(): string[] {
  const dir = storeDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export function patchDevice(name: string, patch: Partial<DeviceRecord>): DeviceRecord {
  const next = { ...loadDevice(name), ...patch };
  saveDevice(next);
  return next;
}
