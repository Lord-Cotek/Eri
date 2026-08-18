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

The stray `/public/` at the repo root — where the kit was originally delivered
— has since been removed. `apps/web/public/brand/` is now the only copy of the
served assets, and the brand guide moved to `docs/BRAND.md` rather than being
deleted with it. Everything else in that directory was either already wired in
or is recoverable from git history.

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

### 16. Hardening after the first review

Four changes made after the phase-1 build, each closing a gap rather than
adding a feature.

**`weekRhythm()` counts resolved events only, and `generateDigest` refuses to
run on an unsettled week.** The digest is written for the ally, so it must not
be built from anything the ally may not see. Previously a PENDING event was
counted, which meant a digest could reach him saying "2 events, he came forward
on 1" while the second window was still open and the man still had his chance to
speak — the one thing the grace window exists to prevent. `weekRhythm` now
filters on `RESOLVED_STATES` in the query, and `weekHasOpenWindow()` makes the
generator wait. Waiting costs nothing: the sweep runs every ten minutes and
picks the week up as soon as the last window closes.

**`Device.covenantId` is bound at registration and matched on thereafter.**
`authenticateDevice` used to re-derive the covenant from `subjectId`, taking the
most recent ACTIVE or REVOKED one. A man who ended one covenant and started
another would have had his old device silently adopted by the new one, and its
events reported to an ally who never agreed to receive them. The covenant is now
recorded on the device inside the registration transaction and looked up by id.
The same fix was applied to the silence sweep, and revocation now retires
devices by `covenantId` rather than `subjectId`, so ending one covenant cannot
retire another's devices.

**The crisis line is required, with no default.** It used to fall back to UK
Samaritans. That was worse than no fallback: a deployment serving another
country would have silently told a man in trouble to call a line that cannot
help him, and nothing would have looked wrong. `CRISIS_LINE_NAME` and
`CRISIS_LINE_CONTACT` are now required in every environment — development, build
and runtime — and `lib/env.ts` throws without them. Other production
requirements (`DATABASE_URL`, `NEXTAUTH_SECRET`, `CRON_SECRET`, `EMAIL_SERVER`
and the two URLs) are checked when a production server starts, but not during
`next build`, since a build machine legitimately has no database or SMTP.

**The stray `/public/` at the repo root is gone.** See § 2.

### 17. Vercel applies migrations; nothing is run by hand

The schema is now under `prisma/migrations/`, and `apps/web`'s build script is:

```
npm run build --workspace @eri/protocol --prefix ../..
prisma generate
prisma migrate deploy
next build
```

`migrate deploy` is the production-safe command — it applies what is committed,
never generates, never prompts, never resets. A failed migration fails the build
and the previous deployment stays live.

The protocol package is rebuilt in the build step rather than relied on from the
root `postinstall`, because Vercel's install cache can skip `postinstall` on a
warm build.

The root `npm run build` calls `build:local` for the web app, which omits
`migrate deploy` — the local and CI path typechecks without touching a database.

Vercel's Root Directory must be `apps/web`, so `vercel.json` moved there; Vercel
reads it relative to the Root Directory. Full walkthrough in `docs/DEPLOY.md`.

### 18. Mail: Resend over HTTPS, SMTP as the fallback

Sign-in is a magic link, so mail is not optional — without a transport nobody
can sign in at all.

`lib/mailer.ts` is now the single place that decides how a message leaves:
`RESEND_API_KEY` first (one HTTPS request, which suits a serverless function
better than holding an SMTP socket open across a cold start), then
`EMAIL_SERVER` over nodemailer, then — in development only — the server
console. `lib/env.ts` requires one of the first two in production, and either
satisfies it.

NextAuth's `sendVerificationRequest` is overridden so the sign-in link goes
through the same transport as everything else, rather than nodemailer
separately. It throws when the send fails, so the "check your inbox" page is
never shown for a message that was not sent.

Sent with `fetch` rather than the Resend SDK: it is one POST, and a transport
this small does not justify a dependency whose major versions we would then
have to track.

### 19. Empty is not unset

A variable added in the Vercel UI and left blank arrives as `""`, which is not
nullish — so `process.env.X ?? default` yielded `""` and the default never
applied. Three consequences, found by reading a real project's variable list:

- `NEXT_PUBLIC_SITE_URL=""` put an empty string into `new URL()` in the root
  layout, which **throws** — the whole site would have 500'd.
- `ANTHROPIC_MODEL_DRAFTING=""` sent an empty model name to the API. Every
  Ẹlẹ́rìí call would have failed into the plain fallback, silently.
- `EMAIL_FROM=""` would have been rejected by the provider.

`blank()` in `lib/env.ts` trims and treats empty as undefined, and every
fallback now reads through it. `siteUrl()` is a single definition, because
invite links, OG metadata, robots and the sitemap must agree — an invitation
built against the wrong origin is one a man cannot accept.

The literal `process.env.NEXT_PUBLIC_SITE_URL` reference is kept inside
`siteUrl()`: Next only inlines `NEXT_PUBLIC_*` where it appears literally.

### 20. The connection string is resolved, not assumed

The first Vercel deploy failed at `prisma migrate deploy` with *"Environment
variable not found: DATABASE_URL"* — after `prisma generate` had just succeeded,
because generate does not need the URL resolved and deploy does.

Two things commonly cause it, and both are outside the repo's control:

- The Neon integration names its variables after the **store**, not the app:
  `eri_DATABASE_URL`, `eri_POSTGRES_PRISMA_URL`. A plain `DATABASE_URL` may not
  exist at all.
- Vercel **withholds variables marked Sensitive from the build step**. They are
  available at runtime only, so a Sensitive `DATABASE_URL` is invisible to a
  migration.

Rather than tell the operator to go find the right toggle, `lib/database-url.mjs`
resolves the string from a list of names — and matches any variable *ending* in
one of them, which is what makes an integration prefix work with no
configuration. It reports which name it used.

`lib/prisma.ts` reads the same resolver and passes the URL to `PrismaClient`
explicitly rather than leaving it to `env("DATABASE_URL")` in the schema. One
resolver, so the thing that migrates the database and the thing that queries it
cannot end up pointed at different databases.

Migrations prefer a **direct** connection (`DIRECT_URL`, `*_DATABASE_URL_UNPOOLED`,
`*_POSTGRES_URL_NON_POOLING`) and fall back to pooled; DDL and advisory locks do
not survive a transaction-mode pooler reliably. Runtime prefers pooled.

Plain JavaScript with JSDoc types, not TypeScript: the build script runs before
anything is compiled and must import it directly, and one file beats two that
drift.

### 21. Preview deployments do not migrate

Migrating from the build introduced a hazard worth naming: a branch carrying a
new migration would apply it the moment somebody opened its preview — to
production's data, if preview and production share a database.

A Vercel build only ever sees its own environment's variables, so a preview
**cannot** determine whether its database is production's. My first attempt
compared the migration URL against the runtime URL, which is nonsense — those
are the direct and pooled strings for the same database, so the guard fired on
every preview and no preview could ever migrate its own branch database.

The rule is now explicit rather than inferred: production migrates, preview does
not unless `ERI_ALLOW_PREVIEW_MIGRATE=1`, and anything not on Vercel migrates.
The cost is that a preview of a schema change runs against the old schema and
may error. That is the right way round — a broken preview is recoverable, a
migrated production database is not.

`scripts/migrate.mjs` also loads `.env` itself, since wrapping the Prisma CLI
lost the automatic loading it used to do. Real environment variables win.

### 22. The invitation was never sent to anyone without an account

`sendInvite` looked the invited address up as a `User` and returned early when
it found nothing:

```ts
const user = await prisma.user.findUnique({ where: { email: covenant.inviteEmail } });
if (!user) return; // He is invited by link; there is nobody to notify in-app yet.
```

The comment was true and the code was wrong. An ally who has never heard of Ẹ̀rí
is the **normal** case for a first invitation — being invited is how most men
will encounter it — so that branch was the one that mattered, and it sent
nothing at all. The subject was left looking at a waiting page with no way to
tell that nothing had happened.

Two paths now. An existing user gets `notify`, which writes an in-app record and
emails him. Everyone else is emailed directly; there is no user to attach a
record to, and the link asks him to sign in, which creates the account.

Three things follow from it:

- **`Covenant.inviteSentAt`** records when a transport actually accepted the
  message. `notify` and `sendInvite` return whether it was delivered rather than
  `void`, so this is a fact rather than an assumption.
- **The waiting page says who was invited and whether it sent.** Waiting on an
  invitation is the one moment in this product where a man is waiting on
  something he cannot see, and silence there is ambiguous between "not yet" and
  "never arrived". It now says which, shows the address, and offers the link.
- **`resendInvite`** re-sends on the same token, so an invitation already in
  somebody's inbox keeps working — a second email that invalidated the first
  would be a trap for the man who finally gets round to opening the older one.
  An expired invitation is extended rather than refused.

The invitation copy was also rewritten. It was addressed to someone who already
knew what Ẹ̀rí was; it now says what being an ally means, that he will never be
shown what the subject saw, that he may decline, and that the link will sign him
in without needing an account first.

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

Last run: **52 passed, 0 failed**, against a database built by
`prisma migrate deploy` from empty.

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
with `BAD_SIGNATURE`, a stale timestamp with `CLOCK_SKEW`, that no digest is
written while a window in that week is still open (and that one appears as soon
as it closes), and that a sentinel cannot report into a covenant that has ended.
