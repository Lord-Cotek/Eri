# eri-sim — the simulated sentinel

This is not a test fixture. It is a first-class client of the public wire
protocol: it generates its own Ed25519 keypair, signs every request, and talks
to the same endpoints the Swift and Kotlin sentinels will.

If something works here and not on a phone, the phone is wrong.

## Use

Mint a pairing code at `/devices` in the web app, then:

```bash
npx eri-sim register --pairing-code ABC12345
npx eri-sim run --profile realistic
npx eri-sim fire --category EXPLICIT_IMAGE --at 01:14
npx eri-sim go-dark --for 8h
npx eri-sim come-back
npx eri-sim heartbeat
npx eri-sim antecedent --kind LATE_HOUR
npx eri-sim status
```

The base URL is `ERI_BASE_URL`, defaulting to `http://localhost:3000`. Device
keys are stored in `$ERI_SIM_HOME`, else `./.eri-sim/` if it exists, else
`~/.eri-sim/` — and are never transmitted.

`--device NAME` runs several simulated devices against one covenant.

## Profiles

| Profile | Shape |
|---|---|
| `quiet` | heartbeats only — proves the system is quiet when there is nothing to say |
| `realistic` | a few events a week, clustered late at night. The default |
| `stress` | many events — tests ally fatigue, digest volume, and whether the rhythm still reads |
| `flaky` | drops 55% of heartbeats — proves silence is detected without the device being gone |

`--speed 60` runs an hour of simulated time per minute, so a week of rhythm can
be watched over a coffee.

## go-dark

`go-dark --for 8h` writes a `darkUntil` marker that the `run` loop honours,
suppressing heartbeats. That is as close as a simulator gets to a man deleting
the app, and it is how silence detection is proved:

- 60 minutes → a `WARNING`, which stays between him and his devices page
- 6 hours → an `ALERT`, and the ally is told

The sweep job is what notices. In a demo, trigger it from `/simulator` rather
than waiting ten minutes for the cron.

## A real device would differ in exactly one way

The private key lives in a file here, which is exactly as secure as it sounds.
On a phone it belongs in the Secure Enclave or the Android Keystore. Everything
else — the envelope, the canonicalisation, the signature, the retry behaviour —
is the same.
