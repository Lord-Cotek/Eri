# Ẹ̀rí

**Ẹ̀rí** (Yoruba: *witness, testimony, record*) is an adult-to-adult
accountability covenant for men fighting pornography. A COTEK product.

Two consenting adults enter a covenant: one is the **subject**, one is the
**ally**. A sentinel on the subject's devices detects explicit content
**on-device** and emits an *event* — never an image, never a URL, never page
text.

---

## The one idea everything serves

Existing products in this category capture the screen and ship blurred
screenshots to the ally. Ẹ̀rí inverts that.

When an event is detected, **nothing goes to the ally.** A grace window opens —
thirty minutes by default — and the *subject* is notified first:

> Something was flagged at 01:14. Do you want to tell him yourself?

- Discloses inside the window → the ally is told **he came forward on his own**.
- Window lapses → the ally is told plainly that an event occurred and was not
  disclosed.
- The ally **never sees the content** — only the category, the timing, and
  whether it was owned.

The headline metric is **days of honest disclosure**, never "days clean".

## Silence is the loudest signal

You cannot make an app un-uninstallable, so Ẹ̀rí does not try. Every device
heartbeats every 15 minutes. After an hour it is late; after six hours it is
silent and **the ally is told**. Ẹ̀rí cannot tell whether that was a flat
battery, a lost phone or a decision — only that it happened.

Making the absence reportable is the honest version of the promise every
product in this category quietly breaks.

## Privacy invariants

Non-negotiable, enforced in the schema, the protocol and the queries. Read
[`docs/PRIVACY-INVARIANTS.md`](docs/PRIVACY-INVARIANTS.md) before changing
anything under `prisma/`, `packages/protocol/` or `lib/notify.ts`.

The short version: **the database must be safe to breach.** The worst a full
dump should reveal is *"an event of category `EXPLICIT_IMAGE` occurred at 01:14
and was disclosed 11 minutes later."*

```bash
npm run check:privacy
```

---

## Phase 1 — what is built

This phase does **not** build the native sentinels. It builds the entire
platform plus a **simulated sentinel** that speaks the real wire protocol, so
the whole system is proved end to end before any Swift or Kotlin is written.
The simulator is a first-class client of a public API, not a test fixture.

```
eri/
  apps/web/                 the platform — Next.js 14, all of it
  apps/ios-sentinel/        stub
  apps/android-sentinel/    stub
  packages/protocol/        event schema, categories, state machine, signing
  packages/simulator/       eri-sim — the simulated sentinel
  docs/                     privacy invariants, protocol, brand, decisions
  scripts/                  acceptance run, privacy check
```

**Stack.** COTEK canonical: Next.js 14 App Router · TypeScript strict · Tailwind
· Neon Postgres + Prisma · NextAuth · Recharts · Anthropic SDK · Vercel.

---

## Running it

```bash
npm install                          # builds the packages, generates Prisma
cp apps/web/.env.example apps/web/.env
# DATABASE_URL, NEXTAUTH_SECRET, and the two CRISIS_LINE_* values at minimum
npm run migrate:deploy --workspace @eri/web
npm run dev
```

**`CRISIS_LINE_NAME` and `CRISIS_LINE_CONTACT` are required in every
environment and have no default.** The app refuses to start without them — in
development, at build, and at runtime. A deployment that cannot name a real
person to call should not tell a man in crisis to call nobody.

With no `EMAIL_SERVER` configured, sign-in links and notification emails are
printed to the server console instead of being sent. That is development-only
and disabled in production.

`ANTHROPIC_API_KEY` is optional. Without it Ẹlẹ́rìí falls back to plain,
non-generated copy — the covenant works whether or not the AI layer is
reachable.

### The simulated sentinel

Mint a pairing code at `/devices`, then:

```bash
npx eri-sim register --pairing-code ABC12345
npx eri-sim run --profile realistic     # heartbeats every 15m, occasional events
npx eri-sim fire --category EXPLICIT_IMAGE --at 01:14
npx eri-sim go-dark --for 8h            # stop heartbeating, to prove silence detection
npx eri-sim status
```

Profiles: `quiet` (heartbeats only) · `realistic` (a few events a week,
clustered late night) · `stress` (many events — tests ally fatigue and digest
volume) · `flaky` (drops heartbeats).

`--speed 60` runs an hour of simulated time per minute, so a week of rhythm can
be watched over a coffee.

There is also a dev-only page at **`/simulator`** with buttons for the same
actions. It 404s in production.

### The sweep

`/api/cron/sweep`, every 10 minutes via Vercel Cron (see `apps/web/vercel.json`). It
lapses expired windows and tells the allies, opens and escalates silences,
generates weekly digests, and prunes spent nonces. Authorised by
`CRON_SECRET`; with no secret configured the endpoint is closed, not open.

---

## Surfaces

| Route | Who | What |
|---|---|---|
| `/` | anyone | editorial landing — explains the inversion, including what it cannot do |
| `/covenant/new` · `/covenant/accept/[token]` | both | read and sign the terms |
| `/subject` | the subject | the open window with a live countdown, the pre-emptive nudge, his rhythm |
| `/ally` | the ally | one question to ask this week, then a sober timeline of resolved events |
| `/devices` | the subject | registration, heartbeat status, silence warnings |
| `/settings` | both | grace window, ending the covenant |
| `/simulator` | dev only | the simulated sentinel, without a terminal |

## Ẹlẹ́rìí

Named for *the one who bears witness*. A witness testifies to what he saw — that
is the whole of his office, and it is the guardrail. He has exactly three jobs:
draft a disclosure when the subject cannot find words, write the ally's weekly
question, and name a pattern in the antecedent data to the subject only.

He never renders a verdict on the state of a man's heart, is never given content
and is instructed never to imagine it, and never congratulates or gamifies. Any
sign of despair or self-harm stops the flow and surfaces a person — enforced by
a tripwire in code, not by instruction alone.

The doctrinal block is delimited in `apps/web/lib/elerii/system-prompt.ts` so it
can be lifted into `@cotek/doctrine` later.

---

## Acceptance

```bash
npm run build                            # typechecks all three workspaces
npm run check:privacy
npm run start --workspace @eri/web       # one shell
npm run acceptance                       # another
```

`scripts/acceptance.mjs` walks the nine phase-1 criteria against a running
server, driving the real UI in a browser and the real CLI. Last run: **47
passed, 0 failed**. See [`docs/DECISIONS.md`](docs/DECISIONS.md) for the
results table and the one caveat.

## Deploying

Vercel, Root Directory `apps/web`. Migrations are applied by the build
(`prisma migrate deploy`), so nothing needs running by hand. Full walkthrough
and the environment-variable table: [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Documents

- [`docs/PRIVACY-INVARIANTS.md`](docs/PRIVACY-INVARIANTS.md) — what may never
  exist, and where each rule is enforced
- [`docs/PROTOCOL.md`](docs/PROTOCOL.md) — every wire field, so the Swift and
  Kotlin work is a transcription job
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — everything the brief left open, and
  what was decided instead
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — Vercel setup, migrations on deploy, and
  every environment variable
- [`docs/BRAND.md`](docs/BRAND.md) — the mark, the palette, the type, the voice

## Out of scope for phase 1

Native sentinels, any real classifier, screen capture of any kind, payments,
multi-ally covenants, a parent/child mode.

---

<sub>∞ A COTEK Product</sub>
