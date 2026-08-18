# Deploying Ẹ̀rí to Vercel

Target: **eri.cotek.app**.

Nothing has to be run on your machine. Migrations are applied by Vercel on every
deploy, before the app is built.

---

## 1. Project settings

| Setting | Value |
|---|---|
| Framework Preset | Next.js |
| **Root Directory** | **`apps/web`** |
| Build Command | leave as the default (`npm run build`) |
| Install Command | leave as the default (`npm install`) |
| Node.js Version | 20.x or 22.x |

**Root Directory must be `apps/web`.** This is a monorepo; Vercel detects the
npm workspace root above it and installs from there, so `@eri/protocol` is
linked and built. `apps/web/vercel.json` — which carries the cron — is read
relative to the Root Directory, which is why it lives there rather than at the
repo root.

Leave "Include source files outside of the Root Directory" **on** (the default
for workspace projects). The build needs `packages/protocol`.

## 2. What the build does

`apps/web`'s build script, in order:

```
npm run build --workspace @eri/protocol --prefix ../..   # compile the shared protocol
prisma generate                                          # client for this schema
prisma migrate deploy                                    # apply pending migrations
next build
```

`scripts/migrate.mjs` wraps `prisma migrate deploy`, which applies everything in
`apps/web/prisma/migrations/` that the database has not seen. It never generates
a migration, never prompts, and never resets. If a migration fails, the build
fails and the previous deployment stays live.

The wrapper exists for three reasons the bare command cannot handle:

1. **It finds the connection string under whatever name it has.** See
   *Where the connection string comes from* below.
2. **It prefers a direct connection.** DDL and advisory locks do not survive a
   transaction-mode pooler reliably.
3. **It leaves Preview deployments alone by default.** A Vercel build sees only
   its own environment's variables, so a preview cannot tell whether it shares
   Production's database. Rather than risk applying an unreviewed migration to
   live data the moment someone opens a preview, previews skip. If previews have
   their own database — the Neon integration can branch one per deployment — set
   `ERI_ALLOW_PREVIEW_MIGRATE=1`.

The build log names the variable and the host it migrated:

```
Applying migrations · DATABASE_URL → ep-xxx-pooler.eu-west-2.aws.neon.tech/neondb
```

The protocol package is rebuilt in the build step rather than relied upon from
`postinstall`, because Vercel's install cache can skip `postinstall` on a warm
build.

### Changing the schema later

Migrations are committed to the repo. When you change `schema.prisma`, generate
the migration once and commit it:

```bash
npm run migrate:dev --workspace @eri/web -- --name what_changed
```

Then push. Vercel applies it. Do not use `db:push` against production — it has
no migration history and can drop columns without telling you.

## 3. Environment variables

Set these in **Project → Settings → Environment Variables**, for **Production**
and **Preview**. See the table in the deployment notes below for which are
required where.

The app refuses to start without `CRISIS_LINE_NAME` and `CRISIS_LINE_CONTACT` —
in every environment, including at build. That is deliberate: a deployment that
cannot name a real person to call should not serve a page telling a man in
crisis to call nobody.

## 4. Database

Create a Neon Postgres database and use the **pooled** connection string as
`DATABASE_URL` — the one with `-pooler` in the host. Serverless functions open
many short-lived connections and will exhaust a direct connection.

`prisma migrate deploy` works over the pooled string. If you later hit advisory
lock problems on a large migration, add `DIRECT_URL` and a `directUrl` line to
the datasource block; it is not needed at this size.

## 5. The domain

Add `eri.cotek.app` in **Project → Settings → Domains**. `.app` is a
Vercel-managed COTEK domain, so there is no external DNS to edit.

Scope domain settings to this project only. A wildcard override has taken a live
COTEK app down before.

Set `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` to `https://eri.cotek.app` once the
domain resolves. Invite links and OG metadata are built from them, so if they
point at a preview URL the invitations a man sends will too.

## 6. The cron

`apps/web/vercel.json` registers `/api/cron/sweep` every 10 minutes. Vercel sends
`Authorization: Bearer $CRON_SECRET`. Without `CRON_SECRET` set, the endpoint
returns 401 to everyone — including Vercel — and **windows never lapse and
silence is never reported**. It is not optional.

Hobby plans limit cron to once per day. The sweep needs to run every 10 minutes
to be honest about a 30-minute grace window, so this needs a Pro plan.

Verify after the first deploy:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://eri.cotek.app/api/cron/sweep
# {"sweptAt":"…","lapsed":0,"silence":{…},"digests":0,"noncesPruned":0}
```

## 7. Mail — Resend

Sign-in is a magic link, so **without a mail transport nobody can sign in at
all** in production. The console fallback is development-only and refuses to
engage when `NODE_ENV=production`.

Two transports are supported, and you set exactly one:

- **`RESEND_API_KEY`** — preferred. One HTTPS request per message, which suits a
  serverless function better than holding an SMTP socket open across a cold
  start. Everything Ẹ̀rí sends goes through it, sign-in links included.
- **`EMAIL_SERVER`** — SMTP, `smtp://user:pass@host:587`, for anyone not on
  Resend.

If both are set, Resend wins.

### Setting Resend up

1. Add and verify a domain in Resend — `cotek.app`, or a subdomain such as
   `mail.cotek.app` if you would rather keep the apex's DNS untouched.
2. Add the DKIM and SPF records Resend gives you and wait for verification.
3. Set `EMAIL_FROM` to an address **on that verified domain**, e.g.
   `no-reply@cotek.app`. Resend rejects anything else, and the rejection is
   logged with its reason.
4. Set `RESEND_API_KEY` to the key. Leave `EMAIL_SERVER` unset.

The `onboarding@resend.dev` sandbox address only delivers to your own account
address. It is fine for a first smoke test and useless for a real ally.

## 8. After the first deploy

1. `https://eri.cotek.app` loads.
2. `https://eri.cotek.app/simulator` returns **404** — confirms the dev-only
   surface is not exposed.
3. Sign in; the magic link arrives.
4. Start a covenant, sign both sides from two accounts.
5. Mint a pairing code at `/devices`, then from any machine:
   ```bash
   ERI_BASE_URL=https://eri.cotek.app npx eri-sim register --pairing-code ABC12345
   ERI_BASE_URL=https://eri.cotek.app npx eri-sim fire --category EXPLICIT_IMAGE --at 01:14
   ```
6. Check the ally's page shows nothing while the window is open.

The `/simulator` page is unavailable in production by design. Use a Preview
deployment for a click-through demo, or the CLI against production as above.

---

## Environment variables — the full table

Set in **Project → Settings → Environment Variables**. Tick **Production** and
**Preview** for all of them unless noted.

### Required — the deploy will not start without these

| Variable | Value for eri.cotek.app | Notes |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** connection string | the one with `-pooler` in the host, `?sslmode=require` |
| `NEXTAUTH_URL` | `https://eri.cotek.app` | preview: leave unset, Vercel infers, or set per-environment |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | signs session cookies |
| `NEXT_PUBLIC_SITE_URL` | `https://eri.cotek.app` | invite links and OG metadata are built from this |
| `RESEND_API_KEY` | `re_…` | **or** `EMAIL_SERVER` — one transport is required |
| `EMAIL_FROM` | `no-reply@cotek.app` | domain must be verified with the provider |
| `CRON_SECRET` | `openssl rand -hex 32` | without it the sweep is closed and **windows never lapse** |
| `CRISIS_LINE_NAME` | e.g. `Samaritans` | **no default. Required at build too.** Set for the region you serve |
| `CRISIS_LINE_CONTACT` | e.g. `116 123 (UK, 24 hours, free)` | a number a man can actually dial tonight |

The two `CRISIS_LINE_*` values are checked at build as well as at runtime, so a
deployment missing them fails the build rather than shipping.

### Optional

| Variable | Default if unset | What you lose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Ẹlẹ́rìí falls back to plain non-generated copy. The covenant still works |
| `ANTHROPIC_MODEL_DRAFTING` | `claude-sonnet-5` | — |
| `ANTHROPIC_MODEL_ROUTINE` | `claude-haiku-4-5-20251001` | — |

### Not to be set

`NODE_ENV` — Vercel sets it. Setting it yourself can switch off the production
guards: the dev sign-in console fallback, and the 404 on `/simulator`.

### Where the connection string comes from

The first deploy failed here, and it is worth knowing why.

`prisma migrate deploy` reads `DATABASE_URL` from the build environment. Two
things commonly mean it is not there:

- **The Neon integration names its variables after the store**, not the app —
  `eri_DATABASE_URL`, `eri_POSTGRES_PRISMA_URL`. The plain `DATABASE_URL` may
  simply not exist.
- **Vercel does not expose variables marked Sensitive to the build step.** They
  are available at runtime only. A `DATABASE_URL` created as Sensitive is
  invisible to a migration.

`lib/database-url.mjs` resolves it from a list rather than depending on one
name, and both the migration script and the app read that same list — so the
thing that migrates the database and the thing that queries it cannot end up
pointed at different databases.

Order of preference:

| For | Tried in order |
|---|---|
| Migrations (direct) | `DIRECT_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`, then the pooled list |
| Runtime (pooled) | `DATABASE_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL` |

Any variable whose name *ends* in one of those is also matched, which is what
makes `eri_DATABASE_URL` work without configuring anything.

**If your deploy still cannot find it**, the simplest fix is a plain,
non-Sensitive `DATABASE_URL` set to the same value as `eri_DATABASE_URL`. The
build failure lists every name it looked for.

### Variables the Neon integration adds

The Vercel–Neon integration creates its own set, prefixed with the store name:
`eri_DATABASE_URL`, `eri_PGHOST`, `eri_POSTGRES_PRISMA_URL`, and so on. **That
prefix is fine and nothing needs renaming.** Ẹ̀rí never reads them; it reads the
unprefixed `DATABASE_URL`, and that is the only one that matters.

Set `DATABASE_URL` to the same value as `eri_DATABASE_URL` — the **pooled**
string, the one with `-pooler` in the host. Do not point it at
`eri_PGHOST_UNPOOLED` or `eri_POSTGRES_URL_NO_SSL`: serverless functions open
many short-lived connections and will exhaust a direct one, and Neon requires
TLS.

The `BLOB_*` variables belong to Vercel Blob and are unused here. Ẹ̀rí stores no
files, by design — there is nothing to store.

### Empty is not unset

A variable added in the Vercel UI and left blank arrives as `""`. The app treats
empty as unset everywhere, so a blank optional variable falls back correctly
rather than putting an empty string into a URL or a model name. Blank *required*
variables still fail the boot check.

Either delete the ones you are not using or leave them blank — both are safe.

### Copy-paste

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/eri?sslmode=require
NEXTAUTH_URL=https://eri.cotek.app
NEXTAUTH_SECRET=
NEXT_PUBLIC_SITE_URL=https://eri.cotek.app
RESEND_API_KEY=
EMAIL_FROM=no-reply@cotek.app
CRON_SECRET=
CRISIS_LINE_NAME=Samaritans
CRISIS_LINE_CONTACT=116 123 (UK, 24 hours, free)
ANTHROPIC_API_KEY=
```

`EMAIL_SERVER`, `ANTHROPIC_MODEL_DRAFTING` and `ANTHROPIC_MODEL_ROUTINE` can be
deleted or left blank.
