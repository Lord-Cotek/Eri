/**
 * A signing sentinel client.
 *
 * The simulator uses this. The Swift and Kotlin sentinels should be a
 * transcription of it — same envelope, same canonicalisation, same headers.
 * If you find yourself adding a field here, add it to `schemas.ts` first.
 *
 * Requires `node:crypto` via `./signing.js`. Server and device only.
 */

import { randomUUID } from "node:crypto";

import {
  HEADER_PROTOCOL_VERSION,
  HEADER_SIGNATURE,
  PROTOCOL_VERSION,
  antecedentResponse,
  eventResponse,
  heartbeatResponse,
  registerResponse,
  type AntecedentKind,
  type AntecedentResponse,
  type DevicePlatform,
  type EventCategory,
  type EventResponse,
  type HeartbeatResponse,
  type ProtocolErrorCode,
  type RegisterResponse,
} from "./index.js";
import { signEnvelope } from "./signing.js";
import type { JsonValue } from "./canonical.js";

export class ProtocolRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ProtocolErrorCode | "UNPARSEABLE",
    message: string,
  ) {
    super(message);
    this.name = "ProtocolRequestError";
  }
}

export type SentinelClientOptions = {
  /** Origin of the Ẹ̀rí web app, e.g. https://eri.cotek.live */
  baseUrl: string;
  /** Raw 32-byte Ed25519 private seed, base64. Stays on the device. */
  privateKey: string;
  /** Assigned by /register. Absent only for the registration call itself. */
  deviceId?: string;
  sentinelVersion: string;
  classifierVersion: string;
  fetchImpl?: typeof fetch;
};

export class SentinelClient {
  constructor(private readonly opts: SentinelClientOptions) {}

  private get fetch(): typeof fetch {
    return this.opts.fetchImpl ?? globalThis.fetch;
  }

  private requireDeviceId(): string {
    const id = this.opts.deviceId;
    if (!id) throw new Error("SentinelClient: deviceId is required — register first");
    return id;
  }

  /**
   * Sign the envelope and POST it. The body sent is `canonicalize(envelope)`
   * itself, so the bytes the server verifies are the bytes it received — there
   * is no re-serialisation step in between to disagree about.
   */
  private async post<T>(path: string, envelope: JsonValue, parse: { parse: (v: unknown) => T }): Promise<T> {
    const signature = signEnvelope(envelope, this.opts.privateKey);
    const body = JSON.stringify(envelope);

    const res = await this.fetch(`${this.opts.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [HEADER_SIGNATURE]: signature,
        [HEADER_PROTOCOL_VERSION]: PROTOCOL_VERSION,
      },
      body,
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ProtocolRequestError(res.status, "UNPARSEABLE", text.slice(0, 200));
    }

    if (!res.ok) {
      const err = json as { error?: ProtocolErrorCode; message?: string };
      throw new ProtocolRequestError(res.status, err.error ?? "UNPARSEABLE", err.message ?? res.statusText);
    }

    return parse.parse(json);
  }

  private envelopeBase(): { v: typeof PROTOCOL_VERSION; nonce: string; sentAt: string } {
    return { v: PROTOCOL_VERSION, nonce: randomUUID(), sentAt: new Date().toISOString() };
  }

  async register(input: {
    pairingCode: string;
    publicKey: string;
    platform: DevicePlatform;
    label: string;
  }): Promise<RegisterResponse> {
    return this.post(
      "/api/v1/sentinel/register",
      {
        ...this.envelopeBase(),
        kind: "register",
        pairingCode: input.pairingCode,
        publicKey: input.publicKey,
        platform: input.platform,
        label: input.label,
        sentinelVersion: this.opts.sentinelVersion,
        classifierVersion: this.opts.classifierVersion,
      },
      registerResponse,
    );
  }

  /**
   * Report a detection.
   *
   * Note what is *not* a parameter: no image, no URL, no app, no text. The
   * classifier ran on-device and the only thing that survives it is a label.
   */
  async event(input: { category: EventCategory; confidence: number; occurredAt: Date }): Promise<EventResponse> {
    return this.post(
      "/api/v1/sentinel/event",
      {
        ...this.envelopeBase(),
        kind: "event",
        deviceId: this.requireDeviceId(),
        occurredAt: input.occurredAt.toISOString(),
        category: input.category,
        confidence: input.confidence,
        classifierVersion: this.opts.classifierVersion,
      },
      eventResponse,
    );
  }

  async heartbeat(): Promise<HeartbeatResponse> {
    return this.post(
      "/api/v1/sentinel/heartbeat",
      {
        ...this.envelopeBase(),
        kind: "heartbeat",
        deviceId: this.requireDeviceId(),
        sentinelVersion: this.opts.sentinelVersion,
        classifierVersion: this.opts.classifierVersion,
      },
      heartbeatResponse,
    );
  }

  async antecedent(input: { antecedent: AntecedentKind; occurredAt: Date }): Promise<AntecedentResponse> {
    return this.post(
      "/api/v1/sentinel/antecedent",
      {
        ...this.envelopeBase(),
        kind: "antecedent",
        deviceId: this.requireDeviceId(),
        occurredAt: input.occurredAt.toISOString(),
        antecedent: input.antecedent,
      },
      antecedentResponse,
    );
  }
}
