# Decisions

Everything the phase 1 brief left open, and what was decided instead. Recorded
so the divergences are visible on review rather than buried in a diff.

---

## Divergences from the brief

### 1. Acceptance criterion 8 cannot pass as literally written

The criterion is:

```bash
grep -riE "screenshot|imageData|url|pageText" prisma/schema.prisma   # → nothing
```

Run verbatim it returns one line:

```
19:  url      = env("DATABASE_URL")
```

Prisma requires `url` in the `datasource` block; there is no schema without it,
and it cannot hold a column. Rather than game the check by moving the datasource
out of the file, `scripts/privacy-check.sh` strips the `generator` and
`datasource` blocks and applies the criterion to the model definitions — which
is what it was written to protect — then extends it to
`packages/protocol/src`, since a content field would reach the database through
the wire schemas just as easily.

It is wired to `npm run check:privacy`, passes clean, and was verified to fail
when a `pageText String?` column is added to `Event`.

### 2. `public/brand/` is not empty

The brief said to leave `public/brand/` empty with a README, and not to generate
placeholder logos. No placeholders were generated — but the brand kit had
already been delivered into this repository, so it is wired in per its own
`BRAND.md` instructions rather than left on the floor:

- `icons/`, `social/`, `svg/` → `apps/web/public/brand/`
- `favicon.ico`, `site.webmanifest` → `apps/web/public/`
- `web/tokens.css` → merged into `app/globals.css`
- `web/HEAD-SNIPPET.html` → expressed as `metadata` in `app/layout.tsx`
- `react/EriMark.tsx` → `components/ui/EriMark.tsx`

The delivered kit stays at `/public/eri-brand-v1/` as the source of truth;
`apps/web/public/brand/README.md` records the mapping.

`app/icon.tsx`, `app/apple-icon.tsx` and `app/opengraph-image.tsx` were
**deliberately not created**, per BRAND.md's warning: the App Router gives those
generators precedence over static files, so the delivered assets would silently
never appear.

### 3. Three models the brief did not list

- **`PairingCode`** — `/register` "exchanges a short-lived pairing code for a
  device record", which needs somewhere to keep the codes. Single-use,
  15-minute life, shown once in the browser, never emailed.
- **`SeenNonce`** — replay rejection is required for all four endpoints, not
  just `/event`, so nonces need a home outside the `Event` table.
- **`Notification`** — the brief says the subject is notified and the ally is
  notified, without saying by what. Push belongs with the native sentinels, and
  email alone would make the acceptance criteria unverifiable and the product
  undemonstrable without an SMTP server. Every notification body comes from a
  fixed template in `lib/notify.ts` that interpolates only a category label, a
  clock time and a state.

`Covenant` also gained `inviteToken`, `inviteEmail` and `inviteExpiresAt`,
because `/covenant/accept/[token]` needs a token to exist.

### 4. The grace window runs from receipt, not from `occurredAt`

The brief says `windowExpiresAt = now + grace`. Made explicit: "now" is server
receipt. A device that was offline for six hours would otherwise hand its owner
an already-expired window, and he would be reported for failing to answer a
question nobody had asked him yet.

### 5. Notifications: in-app always, email best-effort, push deferred

The in-app record is written first and is the source of truth; email is
attempted after and its failure is recorded but never fatal. With no
`EMAIL_SERVER` configured the would-be email is logged to the server console, so
the whole covenant is demonstrable locally.

### 6. Server actions rather than REST for the app's own mutations

`/api/v1/sentinel/*` is a real public API and is versioned as one. The app's own
mutations (disclose, contest, sign, revoke, change the grace window) are Next.js
server actions — less surface, no hand-rolled CSRF, and every action re-derives
the acting user from the session rather than trusting a form field.

Two app-facing routes remain, because both are called by client fetch:
`/api/elerii/draft` and `/api/dev/simulator`.

### 7. `/simulator` is blocked in production with a 404, not a 403

A 403 advertises that the route exists. Both the page and
`/api/dev/simulator` return 404 when `NODE_ENV === "production"`. There is no
override env var: an escape hatch on this would eventually be set on a real
deployment.

A consequence worth knowing: a production Vercel deployment has no `/simulator`
page. Demo from a preview deployment, or use the CLI, which works against any
host via `ERI_BASE_URL`.

The browser simulator's device keys were first held in module memory. That is
not durable enough — Next re-evaluates route modules on recompilation, and a
device registered before a reload lost its key mid-demo. They now go to
`.eri-sim/`, the same store `eri-sim` uses, which also means a device registered
in the browser can be continued from the CLI with
`eri-sim run --device web-<id>`.

### 8. A dev sign-in fallback

Without SMTP, NextAuth's email provider cannot sign anyone in, which would make
the app unrunnable locally. When `EMAIL_SERVER` is unset **and**
`NODE_ENV !== "production"`, the sign-in link is printed to the server console
instead. Guarded on both conditions so a production deploy that has lost its
mail config fails loudly rather than printing sign-in links into a log
aggregator.

### 9. Ẹlẹ́rìí degrades rather than fails

Every one of the three jobs has a plain, non-generated fallback that is usable
as written — not a placeholder. Without `ANTHROPIC_API_KEY`, or when the API
errors, the covenant carries on. Ẹlẹ́rìí is an assistant to it, never a
dependency of it.

`plainWeekSummary()` is deliberately not generated at all: the digest's factual
half is arithmetic and should not wait on a language model.

### 10. The crisis tripwire is code, not instruction

The system prompt tells Ẹlẹ́rìí to stop on any sign of despair or self-harm.
Instruction is not a mechanism, so `lib/elerii/safety.ts` pattern-matches the
subject's own text **before** the request is sent, short-circuits, and returns a
fixed response that cannot drift or be argued past. It over-triggers on purpose.

### 11. Model choice

`claude-sonnet-5` for drafting a disclosure — the one place the output stands in
for a man's voice. `claude-haiku-4-5` for the weekly question and pattern notes,
which are short and frequent. Nothing here is hard enough to want Opus. Both are
overridable by env var.

### 12. Raw Ed25519 keys on the wire, not DER

32-byte public keys and 64-byte signatures, base64. That is what CryptoKit and
Tink produce natively, so the Swift and Kotlin work does not have to learn DER.
Node needs DER, so the server wraps and unwraps in one file.

### 13. Canonical JSON is defined, not assumed

`JSON.stringify` does not guarantee key order across implementations, so
`packages/protocol/src/canonical.ts` defines it: sorted keys, no whitespace,
shortest round-tripping numbers. The signature covers the whole envelope
**including `kind`**, so a signature captured at one endpoint cannot be replayed
at another. Documented with a worked example in `docs/PROTOCOL.md`.

### 14. Monorepo tooling

npm workspaces. `@eri/protocol` and `@eri/simulator` compile with `tsc` to
`dist/` (NodeNext, ESM); the web app consumes the built package rather than the
source, so there is one consumption path and no `transpilePackages` divergence
between the simulator and Next.

`npm run build` at the root builds protocol → simulator → web in order, and
typechecks all three.

### 15. Two product gaps found by the acceptance run and fixed

Both were the same class of bug — a confirmation rendered from client state that
gets unmounted the moment the server revalidates:

- After disclosing, the event stops being pending, so `PendingEventCard`
  unmounted and the subject saw **no confirmation that his ally had been told**.
  Now derived from the server (`justResolvedEvent`) so it survives a reload.
- After revoking, the covenant left `subjectCovenant()`, so `/settings` showed
  "you are not in a covenant" with no confirmation that the ally was notified —
  the one condition he agreed to. Now shown via `endedCovenant()`.

---

## Things left open on purpose

- **`content/covenant-terms.md` is marked `<!-- REVIEW: legal -->`.** It is a
  plain-English description of what the software actually does, written by the
  build and not reviewed by a lawyer. No legal boilerplate was invented. Bump
  `TERMS_VERSION` in `lib/covenant.ts` when the wording changes; the version
  each man signed is recorded and a later revision is never applied
  retroactively.
- **Crisis resources are env-configured** (`CRISIS_LINE_NAME`,
  `CRISIS_LINE_CONTACT`) and default to UK Samaritans. Set them for the region
  the product is offered in.
- **One ally per covenant**, and one open covenant per subject. Multi-ally was
  out of scope; the schema does not preclude it later.
- **No rate limiting yet.** `RATE_LIMITED` exists in the protocol error set and
  is never issued. The signature requirement means an attacker cannot forge
  events, but a device with a stolen key could flood. Worth adding before any
  real deployment.
- **Digests are generated for the *previous* week**, not the current one. A
  digest for a week still in progress is a partial account and an ally would
  read it as the whole one.

---

## Acceptance

`scripts/acceptance.mjs` walks all nine criteria against a running server. It
drives the real UI in a browser and the real `eri-sim` CLI; Prisma is used only
to create the two accounts (which would otherwise need an SMTP round trip) and
to read state back for assertions.

```bash
npm run build
npm run db:push
npm run start --workspace @eri/web        # in one shell
npm run acceptance                        # in another
```

Last run: **47 passed, 0 failed.**

| # | Criterion | Result |
|---|---|---|
| 1 | Two accounts form a covenant, both signing terms | pass |
| 2 | `eri-sim fire` → PENDING, subject notified, **ally's dashboard shows nothing at all** | pass |
| 3 | Disclosing inside the window shows the ally "he told me himself" with his note | pass |
| 4 | A lapsed window is reported automatically, with no content | pass |
| 5 | `eri-sim go-dark --for 8h` raises a silence ALERT to the ally | pass |
| 6 | Revoking notifies the ally immediately | pass |
| 7 | A weekly digest generates with an Ẹlẹ́rìí question | pass (see below) |
| 8 | Privacy grep returns nothing | pass, with the amendment above |
| 9 | `npm run build` typechecks clean | pass |

Criterion 2 is asserted four ways: the ally has no notification row, his page
contains no timeline entry, the HTML does not contain the event id, the category
or the occurrence time, and no text he can read matches
`/pending|flagged|window|awaiting/i`.

**Criterion 7 caveat.** The run above had no `ANTHROPIC_API_KEY` set, so the
question came from Ẹlẹ́rìí's plain fallback path rather than from the model. The
fallback is real product behaviour and it responded correctly to the week's
rhythm — a lapsed window produced *"There was a window you let pass — what was
happening in the half hour before it?"* — but the generated path has not been
exercised against the live API. Set the key and re-run to close that gap.

Beyond the criteria, the run also asserts that a forged signature is rejected
with `BAD_SIGNATURE` and a stale timestamp with `CLOCK_SKEW`.
