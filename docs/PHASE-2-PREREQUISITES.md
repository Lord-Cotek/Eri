# Phase 2 — what Temi has to do

Claude Code can write every line of Swift and Kotlin, structure both projects,
and write the tests. It **cannot** run Xcode, drive a simulator, install on a
phone, request an entitlement, or file a store declaration. Those are yours, and
several have weeks of latency — start the slow ones now, because nothing native
ships without them.

Ordered by lead time. Items 1 and 2 are the long poles.

---

## 1. Apple — entitlements (weeks, start today)

Each of these is a **separate request** against the bundle ID, reviewed by a
human at Apple, and each can be refused. Apply at
<https://developer.apple.com/contact/request/family-controls-distribution>.

| Entitlement | For | Bundle |
|---|---|---|
| `com.apple.developer.family-controls` | the app | `app.cotek.eri` |
| `com.apple.developer.family-controls` | the `DeviceActivityMonitor` extension | `app.cotek.eri.monitor` |
| `com.apple.developer.networking.networkextension` (`content-filter-provider`) | the content-filter extension | `app.cotek.eri.filter` |

Three requests. **Not** the Broadcast Upload entitlement — Tier B is out of
scope and asking for capture we do not use weakens the other two.

**What to say when they ask what it is.** Get this wording consistent
everywhere, because it decides the outcome:

> A self-installed accountability tool for consenting adults. One adult installs
> it on his own device and invites another adult to be told about blocked
> attempts. It is not parental control, not employee monitoring, and it is not
> installable on another person's device. No screen contents are captured or
> transmitted; the app reports that an attempt was blocked, and nothing about
> what was attempted.

Decide the bundle IDs before applying — the entitlement is bound to them and
changing one later means reapplying.

## 2. Google Play — declarations (days to weeks)

- **Foreground service type** `mediaProjection`, declared in Play Console with a
  justification and a **demo video** showing the in-app disclosure and the
  persistent notification.
- **Sensitive permissions declaration** for `PACKAGE_USAGE_STATS`.
- A **live privacy policy URL**. Built: `https://eri.cotek.app/privacy`, public,
  no account needed, in the sitemap. Two things in it need your confirmation
  before submission — see item 5.
- **A data deletion URL.** Play requires apps with accounts to offer account
  deletion, and the console field wants a *URL*, not an email address. The
  policy currently says "write to privacy@cotek.app", which is honest but may
  not satisfy the field. Ask me to build a self-serve deletion route and I
  will — it needs a decision first about what happens to a covenant the other
  man is still in.
- Data safety form: declare that no personal or sensitive user data leaves the
  device. That is true and unusually easy to answer here.

Google's line is that this is permitted only as **disclosed, consented
monitoring**. The persistent notification and the in-app disclosure are policy
requirements, not manners.

## 3. Accounts and signing

| Thing | Why |
|---|---|
| Apple Developer Program membership, active | entitlements and TestFlight |
| App Store Connect app record + bundle IDs registered | the entitlements bind to them |
| Distribution certificate and provisioning profiles | one per target — app, monitor, filter |
| Google Play Console developer account | Play submission |
| Android upload keystore (backed up somewhere you will still have in 2030) | losing it means a new app listing |

If you want CI builds later I will need these as repository secrets, but not
yet — do not put signing keys anywhere until we are actually building.

## 4. Physical devices for testing

The simulator cannot test any of this. `MediaProjection`, `FamilyControls`,
content filters and background refresh all need real hardware.

- **One Android phone**, Android 14 or newer — ideally 15, since that is where
  `MediaProjection` re-consent per session lands. Not your daily driver: it will
  be force-stopped, rebooted and left overnight repeatedly.
- **One iPhone**, iOS 18 or newer, on a **separate Apple ID** from your own.
  Screen Time is per-Apple-ID, and the PIN is held by the ally — you do not want
  that on the phone you actually use.
- **A second Apple ID / Google account** to play the ally, so both sides of a
  covenant can be exercised for real.

## 5. Decisions only you can make

1. **Bundle IDs and package name.** Suggest `app.cotek.eri` and
   `app.cotek.eri` — confirm before I scaffold, because they are baked into the
   entitlement requests.
2. **Who holds the Screen Time PIN**, in practice, on iOS. The design says the
   ally. That means a real conversation between two men at setup, and the flow
   has to be written for it — confirm this is the model you want before I build
   the pairing screens.
3. **The Android classifier.** A bundled TFLite/MediaPipe model has a size, a
   licence and a false-positive rate. Tell me whether you have one in mind or
   want me to pick and benchmark candidates.
4. **Legal review of `content/covenant-terms.md` and `content/privacy-policy.md`.**
   Both marked `<!-- REVIEW: legal -->`. Given the UAE base and the nature of
   the data, both want a lawyer before public launch — not before TestFlight.
   Two facts in the privacy policy the build cannot know and you must confirm:
   the **registered legal entity and its address** (it currently says only
   "COTEK, in the United Arab Emirates"), and that **privacy@cotek.app receives
   mail and somebody answers it**. That address is the contact for every access
   and deletion request the policy promises to honour.
5. **UAE distribution.** Check whether an app of this description has any local
   registration requirement before you list it.

## 6. Small things, quickly

- **`CRISIS_EMERGENCY_CONTACT` must be set in Vercel before the next deploy**, or
  the build fails. See the crisis section of `docs/DEPLOY.md`.
- **`ANTHROPIC_API_KEY`** — acceptance criterion 7 has only ever passed on
  Ẹlẹ́rìí's fallback path. The generated question has never run against the live
  API. Set the key and I will re-run the suite against it.
- A **UAE-registered phone number** to verify 800 HOPE actually connects. I
  confirmed the number and its hours from public sources; I could not dial it.

---

## What I do not need from you

Writing the Swift and Kotlin, the project structure, the protocol client on both
platforms, the local confession prompt, the keystore handling, the test suites,
and the store listing copy. All of that I can do from here and have ready for the
moment the entitlements land.
