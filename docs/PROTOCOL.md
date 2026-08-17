# The Ẹ̀rí sentinel wire protocol

Version `1`.

This document exists so that writing the Swift and Kotlin sentinels is a
**transcription job rather than a design job**. Everything a native client needs
to agree on is fixed here and in `packages/protocol`, which the simulator and
the web app both consume, so they cannot drift.

If something is ambiguous in this document, the source of truth is
`packages/protocol/src/schemas.ts`. If something is missing from that file, it
does not exist on the wire.

Read `docs/PRIVACY-INVARIANTS.md` first. The single most important property of
this protocol is what it refuses to carry.

---

## 1. Shape

Four endpoints, all `POST`, all under `/api/v1/sentinel/`:

| Endpoint | When | Purpose |
|---|---|---|
| `/register` | once, at pairing | exchange a pairing code for a device id |
| `/event` | on detection | report a category and a time |
| `/heartbeat` | every 15 minutes | prove the sentinel is alive |
| `/antecedent` | on a pattern signal | report a circumstance, never content |

Every request body is a **signed envelope**. Every response is JSON.

### Headers

| Header | Value |
|---|---|
| `content-type` | `application/json` |
| `x-eri-signature` | base64 of the raw 64-byte Ed25519 signature |
| `x-eri-protocol` | `1` |

The signature travels in a header rather than in the body so that the bytes the
server verifies are exactly the bytes it received — there is no re-serialisation
step in between for the two sides to disagree about.

---

## 2. Device identity

**Device auth is not session auth.** A stolen bearer token would let an attacker
invent events about a man. A signature cannot be forged without the device.

At registration, the device generates an **Ed25519** keypair. The private half
never leaves the device — Secure Enclave on iOS, Android Keystore on Android, a
file under `.eri-sim/` for the simulator (which is exactly as secure as it
sounds, and is why the simulator is a development tool).

### Key and signature encoding

Raw bytes, base64, standard alphabet with padding:

| Thing | Bytes | Base64 length |
|---|---|---|
| public key | 32 | 44 |
| private seed | 32 | 44 |
| signature | 64 | 88 |

Raw rather than DER because that is what CryptoKit and Tink hand you natively.
Node needs DER, so the server wraps and unwraps in
`packages/protocol/src/signing.ts` and nowhere else.

- **Swift:** `Curve25519.Signing.PrivateKey()`, `.publicKey.rawRepresentation`,
  `.signature(for:)`.
- **Kotlin:** `Ed25519Sign.KeyPair.newKeyPair()` (Tink), or
  `KeyPairGenerator.getInstance("Ed25519")` with a raw-key extraction.

---

## 3. Canonicalisation — the part to get exactly right

Both sides must agree byte-for-byte on what was signed. `JSON.stringify` does
not guarantee key order across implementations, so the protocol defines it.

**Canonical JSON:**

1. Object keys sorted ascending by UTF-16 code unit (a plain lexicographic sort
   of the key strings).
2. No insignificant whitespace anywhere.
3. Arrays keep their given order.
4. `undefined` / absent values are omitted entirely — never serialised as
   `null` unless the value genuinely is `null`.
5. Strings escaped as `JSON.stringify` escapes them.
6. Numbers in the shortest form that round-trips. Non-finite numbers are
   illegal.

The signed bytes are `UTF-8(canonical JSON of the whole envelope)`.

Reference implementation: `packages/protocol/src/canonical.ts`.

**Worked example.** Given the envelope

```json
{ "v": "1", "kind": "event", "b": 2, "a": 1, "nonce": "xxxxxxxxxxxxxxxx" }
```

the canonical form is

```
{"a":1,"b":2,"kind":"event","nonce":"xxxxxxxxxxxxxxxx","v":"1"}
```

Sign those bytes. Send that same string as the request body.

> The signature covers the whole envelope **including `kind`**, so a signature
> lifted from one endpoint cannot be replayed at another.

---

## 4. Freshness and replay

Two mechanisms, both required:

- **`sentAt`** must be within **±5 minutes** of server time. Outside that:
  `CLOCK_SKEW`. This bounds how long a captured request stays useful.
- **`nonce`** is single-use. The server records it on first sight; a repeat is
  `REPLAY`. The recording *is* the claim — one insert guarded by a unique
  constraint — so two concurrent copies of the same request cannot both win.

Nonces are pruned by the sweep job once they are older than twice the skew
window, at which point a replay would be rejected on its timestamp anyway.

A UUID v4 is what the simulator emits. Any opaque token of 16–64 characters is
legal.

---

## 5. The envelopes

Common to every envelope:

| Field | Type | Notes |
|---|---|---|
| `v` | `"1"` | protocol version |
| `kind` | `"register" \| "event" \| "heartbeat" \| "antecedent"` | also discriminates the signature |
| `nonce` | string, 16–64 | single use |
| `sentAt` | RFC 3339 instant, UTC | ±5 min of server time |

### 5.1 `POST /api/v1/sentinel/register`

The one envelope not addressed by `deviceId` — the device does not have one yet.
It is **self-signed**: the signature verifies against the `publicKey` in the
body, proving the sender holds the matching private half. Authorisation comes
from the pairing code, which was shown once in the subject's own browser.

| Field | Type | Notes |
|---|---|---|
| `pairingCode` | string, `[A-Z0-9-]{6,32}` | single use, 15-minute life |
| `publicKey` | base64, 44 chars | raw 32-byte Ed25519 public key |
| `platform` | `IOS \| ANDROID \| MACOS \| WINDOWS \| SIMULATOR` | |
| `label` | string, 1–64 | shown to the subject on `/devices` |
| `sentinelVersion` | string, 1–32 | |
| `classifierVersion` | string, 1–32 | |

**200:**

```json
{
  "deviceId": "clx…",
  "covenantId": "clx…",
  "graceWindowMinutes": 30,
  "heartbeatIntervalMinutes": 15
}
```

Store `deviceId` alongside the private key. It is needed on every later request.

### 5.2 `POST /api/v1/sentinel/event`

| Field | Type | Notes |
|---|---|---|
| `deviceId` | string | from `/register` |
| `occurredAt` | RFC 3339 instant | when detection happened **on-device** |
| `category` | see below | coarse label, never refined |
| `confidence` | number, 0–1 inclusive | classifier confidence |
| `classifierVersion` | string | |

Categories: `EXPLICIT_IMAGE`, `EXPLICIT_VIDEO`, `EXPLICIT_TEXT`, `SUGGESTIVE`,
`BLOCKED_ATTEMPT`, `UNKNOWN`.

**200:**

```json
{ "eventId": "clx…", "state": "PENDING", "windowExpiresAt": "2026-08-17T01:44:00.000Z" }
```

> Note what is absent from the request. There is no image, no URL, no app, no
> page text, no free-text field of any kind. A sentinel physically cannot send
> a sentence. See `docs/PRIVACY-INVARIANTS.md` § 1.

> `occurredAt` may predate `sentAt` — a device that was offline queues events
> and sends them when it can. The grace window runs from **server receipt**, not
> from `occurredAt`, so an offline device cannot hand its owner an
> already-expired window.

### 5.3 `POST /api/v1/sentinel/heartbeat`

Every 15 minutes. The most important endpoint in the system: Ẹ̀rí cannot stop a
man deleting the app, so it makes the absence reportable instead.

| Field | Type |
|---|---|
| `deviceId` | string |
| `sentinelVersion` | string |
| `classifierVersion` | string |

**200:**

```json
{
  "ok": true,
  "graceWindowMinutes": 30,
  "heartbeatIntervalMinutes": 15,
  "covenantActive": true
}
```

`graceWindowMinutes` is echoed so a device picks up a change without polling.

`covenantActive: false` means the covenant has ended. **The sentinel should stop
reporting and uninstall or disable itself.** This is the only endpoint that
accepts a request against an ended covenant, and it exists so a sentinel can
learn to stop rather than retrying forever.

### 5.4 `POST /api/v1/sentinel/antecedent`

Circumstances, not content, and not events.

| Field | Type | Notes |
|---|---|---|
| `deviceId` | string | |
| `occurredAt` | RFC 3339 instant | |
| `antecedent` | `LATE_HOUR \| LONG_IDLE_UNLOCK \| RAPID_APP_SWITCH \| OFF_CHARGER_OVERNIGHT` | |

**200:** `{ "ok": true, "antecedentId": "clx…" }`

These drive the pre-emptive nudge to the subject. They are **never** shown to
the ally individually.

---

## 6. Errors

```json
{ "error": "BAD_SIGNATURE", "message": "Signature did not verify." }
```

| Code | HTTP | Meaning |
|---|---|---|
| `MALFORMED` | 400 | not JSON, or failed schema validation |
| `BAD_PAIRING_CODE` | 400 | unknown, expired or already used |
| `BAD_SIGNATURE` | 401 | signature did not verify, **or the device id is unknown** |
| `CLOCK_SKEW` | 401 | `sentAt` outside ±5 minutes |
| `DEVICE_RETIRED` | 403 | this device was retired |
| `COVENANT_INACTIVE` | 403 | the covenant is not active |
| `REPLAY` | 409 | that nonce has been seen |
| `RATE_LIMITED` | 429 | reserved; not yet issued |
| `SERVER_ERROR` | 500 | |

Two deliberate ambiguities, both to stop enumeration:

- An unknown `deviceId` and a bad signature both return `BAD_SIGNATURE`.
- Unknown, expired and already-used pairing codes all return
  `BAD_PAIRING_CODE`.

### Retry guidance for native clients

| Code | What a sentinel should do |
|---|---|
| `CLOCK_SKEW` | resync the clock, retry once |
| `REPLAY` | a bug in your nonce generation — do not retry the same nonce |
| `MALFORMED` | a bug in your client — do not retry |
| `COVENANT_INACTIVE`, `DEVICE_RETIRED` | stop; disable the sentinel |
| `BAD_SIGNATURE` | stop; re-pair the device |
| 5xx / network | exponential backoff, queue the event, preserve `occurredAt` |

Events must be **queued and retried**, never dropped. A dropped event is a
silent failure of the covenant, which is the one thing this system is built not
to have.

---

## 7. Event lifecycle

The server owns this. A sentinel only ever creates a `PENDING` event.

```
sentinel detects → POST /event → PENDING, windowExpiresAt = receivedAt + grace
                                → the SUBJECT is notified. Nobody else.

subject discloses in window  → DISCLOSED  → ally: "He told you himself."
subject contests in window   → CONTESTED  → ally: "Flagged; he says false positive."
window expires, no action    → LAPSED     → ally: "An event was not disclosed."
```

Transitions are one-way and append-only. Events are never deleted, and nothing
changes state after `resolvedAt` is set. There is no `DISMISSED`.

Reference: `packages/protocol/src/state-machine.ts`.

---

## 8. Silence

| Since last heartbeat | Severity | Who is told |
|---|---|---|
| 60 minutes | `WARNING` | nobody — the subject's `/devices` page only |
| 6 hours | `ALERT` | the ally |

Opened by the sweep job, which runs every 10 minutes. A device that comes back
closes its own silence; the record of the gap stays, because it happened and the
ally was told about it.

A device that has never sent a heartbeat is timed from registration, so a
sentinel that was installed and never ran is not invisible.

---

## 9. Constants

From `packages/protocol/src/categories.ts` — transcribe these, do not re-invent
them:

| Constant | Value |
|---|---|
| `PROTOCOL_VERSION` | `"1"` |
| `HEARTBEAT_INTERVAL_MINUTES` | 15 |
| `SILENCE_WARNING_AFTER_MINUTES` | 60 |
| `SILENCE_ALERT_AFTER_MINUTES` | 360 |
| `GRACE_WINDOW_MIN_MINUTES` | 10 |
| `GRACE_WINDOW_MAX_MINUTES` | 60 |
| `GRACE_WINDOW_DEFAULT_MINUTES` | 30 |
| `DISCLOSURE_NOTE_MAX_LENGTH` | 500 |
| `MAX_CLOCK_SKEW_SECONDS` | 300 |

---

## 10. A complete worked request

```
POST /api/v1/sentinel/event HTTP/1.1
Host: eri.example
content-type: application/json
x-eri-protocol: 1
x-eri-signature: 6H2m…88 chars…==

{"category":"EXPLICIT_IMAGE","classifierVersion":"1.0.0","confidence":0.82,"deviceId":"clx1","kind":"event","nonce":"5f0c…","occurredAt":"2026-08-17T01:14:00.000Z","sentAt":"2026-08-17T01:14:02.113Z","v":"1"}
```

The body is the canonical form, so the signed bytes and the transmitted bytes
are the same string. Build the envelope, canonicalise once, sign that string,
send that string.

---

## 11. Checking your implementation

`packages/simulator` is a working client of this protocol in about 400 lines. To
verify a new native client against a running server:

```bash
npm run dev                                     # the web app
# mint a pairing code at /devices, then:
npx eri-sim register --pairing-code ABC12345    # known-good reference
npx eri-sim fire --category EXPLICIT_IMAGE --at 01:14
```

If your client's canonical string differs from the simulator's for the same
envelope, the difference is your bug — compare against `canonicalize()` before
looking anywhere else.
