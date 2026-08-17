# Privacy invariants

These are not preferences and they are not defaults. They are the product.

If a change to Ẹ̀rí requires breaking one of them, the change is wrong. If a
future contributor adds a column, a field, a log line or a prompt variable that
breaks one, that is a bug — not a trade-off to weigh, not a feature to gate
behind a setting.

Read this before touching `apps/web/prisma/schema.prisma`,
`packages/protocol/src/schemas.ts`, `apps/web/lib/notify.ts`, or anything under
`apps/web/lib/elerii/`.

---

## 1. No content ever crosses the network

No images. No screenshots. No URLs. No page text. No app names. No search
terms. No filenames. No hostnames. No thumbnails, blurred or otherwise.

The classifier runs on the device. What survives it is a label. Everything else
stays where it was, and is never transmitted to anyone — not to an ally, not to
a server, not to us.

**Where this is enforced:** `packages/protocol/src/schemas.ts` is the complete
definition of what may be sent. There is no free-text field on any sentinel
request. A device physically cannot send a sentence.

## 2. Events carry only category, timestamp, confidence, classifier version, device id

That is the entire payload. Six fields, and none of them describes what was
seen.

Categories are deliberately coarse and deliberately few
(`EXPLICIT_IMAGE`, `EXPLICIT_VIDEO`, `EXPLICIT_TEXT`, `SUGGESTIVE`,
`BLOCKED_ATTEMPT`, `UNKNOWN`). There is no mechanism anywhere in the system to
refine one of them into a description, and no subcategory concept exists.

**Where this is enforced:** `eventRequest` in
`packages/protocol/src/schemas.ts`, and the `Event` model in the Prisma schema.

## 3. The database must be safe to breach

Assume a full dump lands on the internet tomorrow. The worst it may reveal about
any man is:

> an event of category `EXPLICIT_IMAGE` occurred at 01:14 and was disclosed 11
> minutes later.

That is the ceiling, and it is the design target rather than an accident of the
current schema. The only free text in the database that pertains to an event is
`Event.disclosureNote`, which the subject wrote himself and chose to send.

**Where this is enforced:** the schema comment above `Event`, and
`scripts/privacy-check.sh`, which fails on any column or wire field whose name
suggests captured content.

## 4. The ally sees nothing during the grace window

Not the event. Not that an event is pending. Not a count. Not a badge on a nav
item. Not "something is being resolved". Silence, until the event reaches a
resolved state one way or another.

This is the whole inversion. Every other product in this category tells the
partner first; Ẹ̀rí tells the man himself and gives him the chance to speak.
Leaking the *existence* of a pending event destroys that, because "he had
something pending and told you at the last minute" is a different thing from "he
told you".

**Where this is enforced:**

- `allyTimeline()` in `apps/web/lib/queries.ts` filters to resolved states in
  the SQL query, so a pending event is never loaded into a page the ally can
  see — not into props, not into HTML, not into the React payload.
- `notifyAllyOfResolution()` in `apps/web/lib/notify.ts` **throws** on a
  `PENDING` event rather than returning quietly, so a caller that gets the
  ordering wrong fails loudly in development.
- `isVisibleToAlly()` in `packages/protocol/src/state-machine.ts` states it once
  for every client.
- The acceptance run asserts that no text an ally can read hints at an open
  window.

## 5. Consent is revocable, but never silently

The subject may end the covenant at any time, for any reason, without
explaining himself. Doing so notifies the ally **immediately** and permanently
marks the covenant as revoked-by-subject.

The notification is written inside the same transaction as the revocation. There
is no window in which the covenant is over and the other man does not know, and
no code path that ends one quietly.

The confirmation screen states the notification in full **before** the button,
not in a toast afterwards.

**Where this is enforced:** `revokeCovenant()` in `apps/web/lib/covenant.ts`;
`RevokeForm` in `apps/web/components/SettingsForms.tsx`.

## 6. There is no silent dismissal

A subject may mark an event as a false positive. It becomes `CONTESTED` and is
still surfaced to the ally, labelled as contested.

There is no `DISMISSED` state, no delete, no snooze, no "not now". The state
machine has three transitions out of `PENDING` and every one of them ends with
the ally being told something.

**Where this is enforced:** `EventState` in the Prisma schema and
`packages/protocol/src/state-machine.ts`. Events are append-only; nothing
deletes one, and nothing edits one after `resolvedAt` is set.

## 7. Antecedents belong to the subject

Pattern signals — a late hour, a phone off the charger, rapid app switching —
drive the pre-emptive nudge, because the intervention belongs *before* the
event.

They are never shown to the ally individually. Only aggregate rhythm reaches
him, and only through a digest.

**Where this is enforced:** `recentAntecedents()` and `antecedentSummary()` are
keyed on `subjectId`; the ally's page never calls either.

## 8. Ẹlẹ́rìí is never given content

He does not have it, and he is instructed never to imagine it. His inputs are
counts, categories, hours of the day and states — read the types in
`apps/web/lib/elerii/index.ts`: there is no field to put content in.

He never renders a verdict on the state of a man's heart. On any sign of
despair, self-harm or suicidal ideation the flow stops and a person is
surfaced — enforced by a keyword tripwire in `apps/web/lib/elerii/safety.ts`
that runs *before* the model call, not by instruction alone.

---

## The check

```bash
npm run check:privacy
```

`scripts/privacy-check.sh` greps the Prisma model definitions and the protocol
wire schemas for anything that smells like captured content. It exits non-zero
on a hit.

Note on acceptance criterion 8: the criterion as originally written is

```bash
grep -riE "screenshot|imageData|url|pageText" prisma/schema.prisma
```

Run verbatim that matches one line — `url = env("DATABASE_URL")` in the
`datasource` block, which Prisma requires and which cannot hold a column. The
script therefore strips the `generator` and `datasource` blocks and applies the
criterion to the models, then extends it to `packages/protocol/src`, since a
content field would reach the database through the wire schemas just as easily.

## What "on-device" will mean when the sentinels exist

Phase 1 does not build the native sentinels, so nothing in this repository
performs classification. When it does, the same invariants apply and are
stricter, not looser: the classifier output must be reduced to a category
*before* it leaves the process that produced it, and the buffer holding the
frame must not outlive that call.
