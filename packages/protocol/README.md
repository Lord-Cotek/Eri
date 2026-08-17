# @eri/protocol

The Ẹ̀rí sentinel wire protocol. Shared by the web app, the simulator and — later
— the native sentinels, so they cannot drift.

Full field reference: [`docs/PROTOCOL.md`](../../docs/PROTOCOL.md).
What may never appear here: [`docs/PRIVACY-INVARIANTS.md`](../../docs/PRIVACY-INVARIANTS.md).

## Import surface

| Entry point | Contents | Environment |
|---|---|---|
| `@eri/protocol` | vocabulary, zod schemas, state machine, canonical JSON | isomorphic — safe in a browser bundle |
| `@eri/protocol/signing` | Ed25519 keygen, sign, verify, freshness | needs `node:crypto` — server and device only |
| `@eri/protocol/client` | `SentinelClient`, a signing HTTP client | server and device only |

Keep `signing` out of client components. The split is the reason the `/simulator`
page can import categories for a dropdown without dragging `node:crypto` into
the bundle.

## Files

| File | What it fixes |
|---|---|
| `categories.ts` | every coarse label and every constant. Transcribe, do not re-invent |
| `canonical.ts` | canonical JSON — the exact bytes that get signed |
| `schemas.ts` | the complete definition of what may cross the network |
| `state-machine.ts` | the event lifecycle, and who may cause each transition |
| `signing.ts` | Ed25519, raw keys in and out, DER hidden here and nowhere else |
| `client.ts` | the reference client the native sentinels should transcribe |

## The two things to get exactly right

**Canonicalisation.** Object keys sorted, no whitespace, shortest
round-tripping numbers. The body sent on the wire *is* the canonical string, so
the signed bytes and the transmitted bytes are the same object.

**The signature covers `kind`.** A signature captured at one endpoint cannot be
replayed at another.

## Building

```bash
npm run build --workspace @eri/protocol   # tsc → dist/ (NodeNext ESM + .d.ts)
```

The web app consumes the built package rather than the source, so there is one
consumption path shared with the simulator.
