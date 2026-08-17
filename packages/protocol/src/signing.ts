/**
 * Ed25519 device identity.
 *
 * Device auth is not session auth. Each device generates a keypair once, at
 * registration, and the private half never leaves the device. Every request is
 * signed; the server verifies against the `publicKey` it stored at
 * registration. A stolen bearer token would let an attacker *invent* events
 * about a man; a signature cannot be forged without the device.
 *
 * Keys and signatures travel as **raw bytes, base64** — 32 bytes for a public
 * key, 64 for a signature. That is what CryptoKit and Tink hand you natively,
 * so the Swift and Kotlin sentinels do not have to learn DER. Node needs DER,
 * so we wrap and unwrap here and nowhere else.
 *
 * This module imports `node:crypto`. Keep it out of client components — import
 * it as `@eri/protocol/signing`, never from the package root.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
  timingSafeEqual,
  type KeyObject,
} from "node:crypto";

import { canonicalBytes, type JsonValue } from "./canonical.js";

/** DER prefix for an Ed25519 SubjectPublicKeyInfo wrapping a 32-byte key. */
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** DER prefix for an Ed25519 PKCS#8 PrivateKeyInfo wrapping a 32-byte seed. */
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export const RAW_PUBLIC_KEY_BYTES = 32;
export const RAW_PRIVATE_KEY_BYTES = 32;
export const SIGNATURE_BYTES = 64;

export type DeviceKeyPair = {
  /** Raw 32-byte public key, base64. Sent to the server at registration. */
  publicKey: string;
  /** Raw 32-byte private seed, base64. Never leaves the device. */
  privateKey: string;
};

/* ------------------------------------------------------------------ */
/* Key handling                                                        */
/* ------------------------------------------------------------------ */

export function generateDeviceKeyPair(): DeviceKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: rawPublicKeyFrom(publicKey).toString("base64"),
    privateKey: rawPrivateKeyFrom(privateKey).toString("base64"),
  };
}

function rawPublicKeyFrom(key: KeyObject): Buffer {
  const der = key.export({ format: "der", type: "spki" });
  return Buffer.from(der.subarray(der.length - RAW_PUBLIC_KEY_BYTES));
}

function rawPrivateKeyFrom(key: KeyObject): Buffer {
  const der = key.export({ format: "der", type: "pkcs8" });
  return Buffer.from(der.subarray(der.length - RAW_PRIVATE_KEY_BYTES));
}

function importPublicKey(rawBase64: string): KeyObject {
  const raw = Buffer.from(rawBase64, "base64");
  if (raw.length !== RAW_PUBLIC_KEY_BYTES) {
    throw new Error(`expected a ${RAW_PUBLIC_KEY_BYTES}-byte Ed25519 public key`);
  }
  return createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

function importPrivateKey(rawBase64: string): KeyObject {
  const raw = Buffer.from(rawBase64, "base64");
  if (raw.length !== RAW_PRIVATE_KEY_BYTES) {
    throw new Error(`expected a ${RAW_PRIVATE_KEY_BYTES}-byte Ed25519 private seed`);
  }
  return createPrivateKey({
    key: Buffer.concat([PKCS8_PREFIX, raw]),
    format: "der",
    type: "pkcs8",
  });
}

/* ------------------------------------------------------------------ */
/* Signing and verification                                            */
/* ------------------------------------------------------------------ */

/**
 * Sign a request envelope. The signed bytes are `canonicalize(envelope)` — the
 * whole envelope, `kind` included, so a signature lifted from one endpoint
 * cannot be replayed at another.
 */
export function signEnvelope(envelope: JsonValue, privateKeyBase64: string): string {
  const key = importPrivateKey(privateKeyBase64);
  const signature = nodeSign(null, canonicalBytes(envelope), key);
  return signature.toString("base64");
}

/** Verify a signature over an envelope. Never throws — a malformed key is a failed verify. */
export function verifyEnvelope(
  envelope: JsonValue,
  signatureBase64: string,
  publicKeyBase64: string,
): boolean {
  try {
    const signature = Buffer.from(signatureBase64, "base64");
    if (signature.length !== SIGNATURE_BYTES) return false;
    const key = importPublicKey(publicKeyBase64);
    return nodeVerify(null, canonicalBytes(envelope), key, signature);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Freshness                                                           */
/* ------------------------------------------------------------------ */

export type FreshnessResult = { ok: true } | { ok: false; reason: "CLOCK_SKEW" };

/**
 * Reject envelopes whose `sentAt` is too far from server time in either
 * direction. Combined with single-use nonces, this bounds how long a captured
 * request stays useful to an attacker.
 */
export function checkFreshness(sentAt: Date, now: Date, maxSkewSeconds: number): FreshnessResult {
  const skewMs = Math.abs(now.getTime() - sentAt.getTime());
  if (skewMs > maxSkewSeconds * 1000) return { ok: false, reason: "CLOCK_SKEW" };
  return { ok: true };
}

/** Constant-time string compare, for pairing codes and cron secrets. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
