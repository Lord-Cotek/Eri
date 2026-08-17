# apps/android-sentinel

**Not built in phase 1.** This folder is a placeholder.

The Android sentinel is a client of the wire protocol defined in
[`packages/protocol`](../../packages/protocol) and documented in
[`docs/PROTOCOL.md`](../../docs/PROTOCOL.md). That document exists so this work
is a transcription job rather than a design job — every field, every constant
and the exact canonicalisation rule are already fixed.

## Before writing any Kotlin

Read [`docs/PRIVACY-INVARIANTS.md`](../../docs/PRIVACY-INVARIANTS.md). The
sentinel is the one component that will ever hold content, so it is the one
component where an invariant can actually be broken.

The rule that governs this app: **classification output must be reduced to a
category before it leaves the process that produced it, and the buffer holding
the frame must not outlive that call.** Nothing derived from the pixels — no
hash, no thumbnail, no bounding box, no extracted text — may reach the network
or persistent storage.

## What it has to do

1. Generate an Ed25519 keypair at registration and keep the private half in the
   Android Keystore. Tink's `Ed25519Sign.KeyPair.newKeyPair()`, or
   `KeyPairGenerator.getInstance("Ed25519")` with a raw-key extraction; send the
   raw 32-byte public key base64-encoded.
2. Exchange a pairing code for a device id via `POST /api/v1/sentinel/register`.
3. Classify on-device and `POST /api/v1/sentinel/event` with a coarse category,
   a timestamp, a confidence and a classifier version. Nothing else.
4. Heartbeat every 15 minutes — a `WorkManager` periodic job survives reboots
   and Doze better than an alarm. This is the most important thing it does: the
   absence of a heartbeat is what makes the app's own removal reportable.
5. Emit antecedent signals: late hour, long idle unlock, rapid app switch, off
   charger overnight.
6. Queue and retry events across network failures, preserving `occurredAt`. A
   dropped event is a silent failure of the covenant.
7. Stop and disable itself when a heartbeat returns `covenantActive: false`.

## Verifying it

`packages/simulator` is a working reference client in about 400 lines. If the
canonical string your client signs differs from the simulator's for the same
envelope, the difference is your bug.

```bash
npx eri-sim register --pairing-code ABC12345   # known-good reference
```
