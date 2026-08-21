<!-- REVIEW: legal -->
<!--
     Written by the build from the actual schema and the actual code paths, not
     from a template. Every claim below is checkable against
     apps/web/prisma/schema.prisma, packages/protocol/src/schemas.ts and
     docs/PRIVACY-INVARIANTS.md.

     It has not been reviewed by a lawyer. Before public launch, and certainly
     before store submission, counsel should check it — and two things need
     confirming that the build cannot know:

       1. The registered legal entity and its address. "COTEK" appears below
          without either.
       2. That support@cotek.live receives mail and somebody answers it.

     The version is PRIVACY_VERSION in lib/legal.ts, rendered in the page
     header rather than repeated here. Bump it whenever the wording changes.
-->

# Privacy

Ẹ̀rí is built so that there is almost nothing here to disclose. That is the
product, not a policy position.

Detection happens on your own device. **No image, screenshot, video frame, web
address, page text, search term or app name is ever transmitted to us, stored by
us, or shown to your ally.** There is no mechanism in the software to do any of
those things. What crosses the network is a coarse label, a timestamp and a
number.

This page explains exactly what is collected, who can see it, and what we cannot
tell you even if we wanted to.

---

## Who this is

Ẹ̀rí is operated by **COTEK**, in the United Arab Emirates. We are the
controller of the data described here.

Questions, requests, or a complaint: [support@cotek.live](mailto:support@cotek.live).

## What Ẹ̀rí never collects

Listed first, because it is the more important half.

- Images, screenshots, or video frames — from any app, at any time.
- Web addresses, hostnames, page titles, or page text.
- Search terms.
- The names of apps you use.
- Your location.
- Your contacts, messages, call history, photos, or files.
- Your browsing history.
- Advertising identifiers. We run no advertising and no third-party analytics.

None of this is a promise about our intentions. There is no column in the
database and no field in the wire protocol that could hold any of it, and a
check that runs against both is part of the build.

## What is collected, and why

### When you make an account

- **Your email address.** To sign you in — Ẹ̀rí has no passwords, only a link
  sent to your inbox — and to send you the messages the covenant requires.
- **A name, if you give one.** Only so the other man sees a name rather than an
  email address. It is optional.
- **Sign-in sessions.** A token in a cookie so you stay signed in.

### When you form a covenant

- The email address of the man you invite, so the invitation can reach him.
- Which version of the terms each of you signed, and when.
- Your chosen grace window.
- If the covenant ends: when, and which of you ended it.

### From a device running the sentinel

- **The label you chose for it**, such as "my phone". You write it; we do not
  read the device name.
- The platform (iPhone, Android), the operating system version, and the version
  of the sentinel and its classifier. Used for support and for knowing which
  version produced which event.
- **A public key.** Generated on the device at pairing. The private half never
  leaves the device, which is how the server can verify an event came from your
  phone and can never manufacture one.
- **When it last checked in.** Every fifteen minutes, so its absence is
  reportable.

### When something is detected

This is the whole of it:

- **A category**, one of six: explicit image, explicit video, explicit text,
  suggestive, blocked attempt, unclassified.
- **When it happened**, and when it reached the server.
- **A confidence number** from the classifier, and the classifier's version.
- **Which of your devices** it came from.
- **What became of it** — whether you came forward, contested it, or let the
  window lapse.
- **The note you wrote**, if you wrote one. Up to 500 characters, in your own
  words, sent because you chose to send it.

The classifier runs on your device and the frame it examined is discarded
immediately. It is never written to storage and never sent anywhere.

### Circumstances

Signals about the shape of your day, never about content: a late hour, a long
idle before unlocking, rapid app switching, a phone off the charger overnight.

These exist so Ẹ̀rí can say something *before* an event rather than only after.
**They are never shown to your ally individually** — only the general shape of a
week ever reaches him.

## Who can see what

**Your ally sees** resolved events only: the category, the time, whether you
came forward, and the note you chose to write. He sees a weekly question and a
plain summary of the week's counts. He is told when a device goes quiet.

**Your ally never sees** anything during your grace window — not the event, not
that one is pending, not a count, not a badge. Nothing at all until it resolves
one way or the other. He never sees an individual circumstance signal. He never
sees content, because none exists.

**We see** what is in the database, which is the list above. Access is limited
to what support and operating the service require, and there is nothing in it
that would tell us what anybody looked at.

**Nobody else sees any of it.** We do not sell data, share it with advertisers,
or disclose it to your church, your employer, your family, or anyone else,
except where the law compels us — and we will tell you if that happens, unless
we are forbidden from doing so.

## Who processes it for us

Ẹ̀rí runs on other people's infrastructure. These are the only companies that
handle any of it:

- **[Vercel](https://vercel.com/legal/privacy-policy)** — hosting.
- **[Neon](https://neon.tech/privacy-policy)** — the database.
- **[Resend](https://resend.com/legal/privacy-policy)** — email delivery.
  Receives your email address and the text of the message.
- **[Anthropic](https://www.anthropic.com/legal/privacy)** — Ẹlẹ́rìí, the
  assistant. See below.

### What Ẹlẹ́rìí is given

Ẹlẹ́rìí has three jobs: drafting a disclosure when you cannot find the words,
writing your ally's weekly question, and naming a pattern in your circumstances.

He is given counts, category labels, hours of the day, and whether events were
owned. **He is never given content, because none exists in the system to give
him**, and he is instructed never to speculate about it.

One exception you should know about: **when you ask him to draft a disclosure,
the words you have already typed are sent with the request**, so the draft
sounds like you. That text goes to Anthropic's API. If you would rather it did
not, do not use that button — the covenant works identically without it.
Anthropic's API terms state that inputs submitted through the API are not used
to train their models.

Before anything reaches Ẹlẹ́rìí, your text is checked on our server for signs of
crisis. If any are found, no request is sent at all and you are shown a fixed
message pointing you to a person.

## How long it is kept

**Events are never deleted.** The honesty of the record is the point of the
product; a record that could be quietly edited would not be worth having. They
are kept for as long as your account exists.

Sign-in sessions expire. Invitation links expire. Single-use tokens used to stop
replayed requests are deleted within minutes. Notifications and weekly digests
are kept with the account.

## Deleting your account

Write to [support@cotek.live](mailto:support@cotek.live) from the address on the
account. We will delete your account, your devices, your events and your
covenant record, and confirm when it is done.

Two honest caveats:

- Ending a covenant and deleting an account are different things. Ending one
  notifies the other man immediately, by design; deleting your account does not
  un-tell him what he was already told.
- Deletion is currently handled by hand rather than by a button. If it matters
  to you that it be immediate, say so and we will treat it that way.

## Your rights

You may ask us what we hold about you, ask for a copy, ask us to correct it, or
ask us to delete it. Write to [support@cotek.live](mailto:support@cotek.live).

Depending on where you live, the UAE Personal Data Protection Law or the UK and
EU GDPR may give you these rights as a matter of law rather than as a matter of
our willingness. Either way, ask.

You may also withdraw from the covenant at any time, from the settings page,
without giving a reason. Your ally is told that you did. That is the one
condition and it is stated on the button before you press it.

## Children

Ẹ̀rí is for adults. You must be 18 or over to use it, and we do not knowingly
collect anything from anyone younger.

It is **not** a parental control and not employee monitoring. Nobody can install
it on anybody else's device: a man installs it on his own, and invites another
adult to be told. If someone is pressing you to sign a covenant you do not want,
do not sign it.

## Security

- Every message from a device is signed with a key that never leaves that
  device, so an event cannot be forged.
- Everything travels over TLS and is encrypted at rest by our database provider.
- Requests are rejected if they are stale or repeated.
- The strongest measure is the design: there is nothing here worth stealing. A
  complete copy of our database would tell a reader that an event of some
  category happened at some time and whether it was owned. Nothing more.

## Changes

If this changes, the version at the top changes, and we will tell you before it
takes effect if the change is one that matters.

## Contact

[support@cotek.live](mailto:support@cotek.live)

---

See also [the covenant terms](/covenant/new#terms), which describe what each man
agrees to.
