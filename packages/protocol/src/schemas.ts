/**
 * Ẹ̀rí wire protocol — zod schemas and inferred types.
 *
 * This file is the single source of truth shared by the web app, the simulator,
 * and (later) the Swift and Kotlin sentinels. If a field is not here, it does
 * not exist on the wire.
 *
 * PRIVACY INVARIANT: no schema in this file admits an image, a URL, a hostname,
 * an app name, page text, a search term, or any free-text field authored by a
 * *device*. The only free text the protocol ever carries is a disclosure note,
 * and that is authored by the subject through the web app — never by a sentinel.
 * See docs/PRIVACY-INVARIANTS.md.
 */

import { z } from "zod";
import {
  ANTECEDENT_KINDS,
  DEVICE_PLATFORMS,
  EVENT_CATEGORIES,
  PROTOCOL_VERSION,
} from "./categories.js";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** RFC 3339 / ISO 8601 instant, always UTC on the wire. */
export const isoInstant = z
  .string()
  .datetime({ offset: true })
  .describe("RFC 3339 instant, e.g. 2026-08-17T01:14:00.000Z");

/** Base64, standard alphabet with padding. */
export const base64 = z
  .string()
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, "expected standard base64");

/** Raw Ed25519 public key, 32 bytes, base64 → 44 chars with padding. */
export const publicKeyB64 = base64.length(44).describe("raw 32-byte Ed25519 public key, base64");

/** Raw Ed25519 signature, 64 bytes, base64 → 88 chars with padding. */
export const signatureB64 = base64.length(88).describe("raw 64-byte Ed25519 signature, base64");

/** A single-use nonce. UUID v4 is what the simulator emits; any 16–64 char opaque token is legal. */
export const nonce = z.string().min(16).max(64);

export const semver = z.string().min(1).max(32).regex(/^[A-Za-z0-9._+-]+$/);

export const deviceLabel = z.string().min(1).max(64);

/** A pairing code is short-lived and single-use. Shown once, in the web app. */
export const pairingCode = z.string().min(6).max(32).regex(/^[A-Z0-9-]+$/);

export const protocolVersion = z.literal(PROTOCOL_VERSION);

export const eventCategory = z.enum(EVENT_CATEGORIES);
export const antecedentKind = z.enum(ANTECEDENT_KINDS);
export const devicePlatform = z.enum(DEVICE_PLATFORMS);

/** Classifier confidence, 0–1 inclusive. */
export const confidence = z.number().min(0).max(1);

/* ------------------------------------------------------------------ */
/* The signed envelope                                                 */
/* ------------------------------------------------------------------ */

/**
 * Every sentinel request is a signed envelope.
 *
 * The signature covers `canonicalize(envelope)` — the whole envelope including
 * `kind`, so a signature captured from one endpoint cannot be replayed at
 * another. It travels in the `x-eri-signature` header, not in the body, so the
 * signed bytes and the transmitted bytes are the same object.
 */
const envelopeBase = {
  v: protocolVersion,
  nonce,
  /** When the device sent this. Rejected if skewed more than ±5 minutes. */
  sentAt: isoInstant,
};

export const ENVELOPE_KINDS = ["register", "event", "heartbeat", "antecedent"] as const;
export type EnvelopeKind = (typeof ENVELOPE_KINDS)[number];

/* ---- register ---------------------------------------------------- */

/**
 * Registration is the one envelope not addressed by `deviceId` — the device
 * does not have one yet. It is self-signed: the signature proves the sender
 * holds the private half of the `publicKey` it is presenting.
 */
export const registerRequest = z.object({
  ...envelopeBase,
  kind: z.literal("register"),
  pairingCode,
  publicKey: publicKeyB64,
  platform: devicePlatform,
  label: deviceLabel,
  sentinelVersion: semver,
  classifierVersion: semver,
});
export type RegisterRequest = z.infer<typeof registerRequest>;

export const registerResponse = z.object({
  deviceId: z.string(),
  covenantId: z.string(),
  graceWindowMinutes: z.number().int(),
  heartbeatIntervalMinutes: z.number().int(),
});
export type RegisterResponse = z.infer<typeof registerResponse>;

/* ---- event ------------------------------------------------------- */

export const eventRequest = z.object({
  ...envelopeBase,
  kind: z.literal("event"),
  deviceId: z.string().min(1),
  /** When detection happened on-device, which may predate `sentAt` if offline. */
  occurredAt: isoInstant,
  category: eventCategory,
  confidence,
  classifierVersion: semver,
});
export type EventRequest = z.infer<typeof eventRequest>;

export const eventResponse = z.object({
  eventId: z.string(),
  state: z.literal("PENDING"),
  /** When the subject's chance to speak first runs out. */
  windowExpiresAt: isoInstant,
});
export type EventResponse = z.infer<typeof eventResponse>;

/* ---- heartbeat --------------------------------------------------- */

export const heartbeatRequest = z.object({
  ...envelopeBase,
  kind: z.literal("heartbeat"),
  deviceId: z.string().min(1),
  sentinelVersion: semver,
  classifierVersion: semver,
});
export type HeartbeatRequest = z.infer<typeof heartbeatRequest>;

export const heartbeatResponse = z.object({
  ok: z.literal(true),
  /** Echoed so a device can pick up a grace-window change without polling. */
  graceWindowMinutes: z.number().int(),
  heartbeatIntervalMinutes: z.number().int(),
  /** If the covenant ended, the sentinel should stop and uninstall itself. */
  covenantActive: z.boolean(),
});
export type HeartbeatResponse = z.infer<typeof heartbeatResponse>;

/* ---- antecedent -------------------------------------------------- */

export const antecedentRequest = z.object({
  ...envelopeBase,
  kind: z.literal("antecedent"),
  deviceId: z.string().min(1),
  occurredAt: isoInstant,
  antecedent: antecedentKind,
});
export type AntecedentRequest = z.infer<typeof antecedentRequest>;

export const antecedentResponse = z.object({ ok: z.literal(true), antecedentId: z.string() });
export type AntecedentResponse = z.infer<typeof antecedentResponse>;

/* ---- union ------------------------------------------------------- */

export const sentinelRequest = z.discriminatedUnion("kind", [
  registerRequest,
  eventRequest,
  heartbeatRequest,
  antecedentRequest,
]);
export type SentinelRequest = z.infer<typeof sentinelRequest>;

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/**
 * Wire error codes. Kept coarse on purpose — a caller that cannot authenticate
 * should not learn from the error whether a device id exists.
 */
export const PROTOCOL_ERROR_CODES = [
  "MALFORMED",
  "BAD_SIGNATURE",
  "CLOCK_SKEW",
  "REPLAY",
  "UNKNOWN_DEVICE",
  "DEVICE_RETIRED",
  "COVENANT_INACTIVE",
  "BAD_PAIRING_CODE",
  "RATE_LIMITED",
  "SERVER_ERROR",
] as const;
export type ProtocolErrorCode = (typeof PROTOCOL_ERROR_CODES)[number];

export const protocolError = z.object({
  error: z.enum(PROTOCOL_ERROR_CODES),
  message: z.string(),
});
export type ProtocolError = z.infer<typeof protocolError>;

/** HTTP status each error code is returned with. */
export const PROTOCOL_ERROR_STATUS: Record<ProtocolErrorCode, number> = {
  MALFORMED: 400,
  BAD_SIGNATURE: 401,
  CLOCK_SKEW: 401,
  REPLAY: 409,
  UNKNOWN_DEVICE: 401,
  DEVICE_RETIRED: 403,
  COVENANT_INACTIVE: 403,
  BAD_PAIRING_CODE: 400,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

/* ------------------------------------------------------------------ */
/* Headers                                                             */
/* ------------------------------------------------------------------ */

export const HEADER_SIGNATURE = "x-eri-signature";
export const HEADER_PROTOCOL_VERSION = "x-eri-protocol";
