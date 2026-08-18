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

`prisma migrate deploy` applies everything in `apps/web/prisma/migrations/` that
the database has not seen. It never generates a migration, never prompts, and
never resets — it is the production-safe command. If a migration fails, the
build fails and the previous deployment stays live.

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

## 7. Email

Sign-in is a magic link, so **without SMTP nobody can sign in at all** in
production. The console fallback is development-only and refuses to engage when
`NODE_ENV=production`.

Any SMTP provider works. `EMAIL_SERVER` is a connection string:
`smtp://user:pass@host:587`. Set `EMAIL_FROM` to an address on a domain whose
SPF and DKIM you control, or the links will land in spam.

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
| `EMAIL_SERVER` | `smtp://user:pass@host:587` | without it nobody can sign in |
| `EMAIL_FROM` | `no-reply@cotek.app` | use a domain whose SPF/DKIM you control |
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

### Copy-paste

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/eri?sslmode=require
NEXTAUTH_URL=https://eri.cotek.app
NEXTAUTH_SECRET=
NEXT_PUBLIC_SITE_URL=https://eri.cotek.app
EMAIL_SERVER=smtp://USER:PASSWORD@smtp.example.com:587
EMAIL_FROM=no-reply@cotek.app
CRON_SECRET=
CRISIS_LINE_NAME=Samaritans
CRISIS_LINE_CONTACT=116 123 (UK, 24 hours, free)
ANTHROPIC_API_KEY=
```
