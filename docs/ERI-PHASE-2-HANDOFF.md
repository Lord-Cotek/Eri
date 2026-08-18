# Ẹ̀rí — build handoff: fixes + phase 2 (native sentinels)

Point Claude Code at this file at the root of the `eri` repo. It assumes phase 1 is built
and deployed at `https://eri.cotek.app`.

Work in the order given. Section 1 is small and blocking; do not start section 3 until
section 1 is merged and section 2's entitlements have been *requested* (Temi does that, not
you — see section 5).

---

## 0. What Ẹ̀rí is, so the decisions make sense

Ẹ̀rí (Yoruba: *witness, testimony, record*) is an adult-to-adult accountability covenant for
men fighting pornography. Two consenting adults: a **subject** and an **ally**. A sentinel on
the subject's device detects explicit content **on-device** and emits an *event* — a coarse
category, a timestamp, a confidence score. Never an image. Never a URL. Never page text.

The one idea that makes this different from Covenant Eyes and Truple: when an event is
detected, **nothing goes to the ally immediately**. A grace window opens (default 30 min) and
the *subject* is told first — *"Something was flagged at 01:14. Do you want to tell him
yourself?"* If he discloses inside the window, the ally is told he came forward on his own.
If it lapses, the system reports it plainly. The ally never sees content, only the category,
the timing, and whether it was owned.

The headline metric is **days of honest disclosure**, never "days clean".

Three consequences that govern every decision below:

1. **The database must be safe to breach.** See `docs/PRIVACY-INVARIANTS.md`. This is the
   constraint that outranks features.
2. **You cannot make an app un-uninstallable, so do not try.** The sentinel emits a signed
   heartbeat and the platform reports *absence*. Silence is the loudest signal. Tamper-evidence,
   not tamper-proofing.
3. **The sentinel is visible, never covert.** Both stores treat covert monitoring as
   stalkerware, and more importantly the product is a covenant, not surveillance. The
   notification that says the app is running is a feature.

---

## 1. Fixes to phase 1 — do these first

### 1.1 Pending events leak through digest arithmetic

`weekRhythm()` in `apps/web/lib/queries.ts` counts every event in the week into `totalEvents`,
but `disclosedByHim`, `lapsed` and `contested` each filter on a resolved state. So
`totalEvents` minus those three equals the number of events still in an open window — and
`plainWeekSummary()` prints both numbers to the ally.

Exposure is at the week boundary: `generateDueDigests` runs on every 10-minute sweep, so last
week's digest is written on the first sweep after rollover. An event received 23:52 Sunday with
a 30-minute window is still `PENDING` at 00:10 Monday. The digest stores the inflated count and
does not self-correct when the event later resolves. The same number goes into
`weeklyQuestion`'s prompt, so Ẹlẹ́rìí can allude to it.

- Filter `weekRhythm`'s event query on `RESOLVED_STATES`.
- Make `generateDigest` return `null` while any event in that week is still `PENDING`, so the
  next sweep picks it up.
- Add acceptance criterion **2b**: fire an event just before a week rollover, sweep, assert the
  digest arithmetic reconciles and no count implies an open window.

### 1.2 Devices are not bound to the covenant they were paired under

`Device` stores `subjectId` but not `covenantId`. `/register` knows the covenant (the pairing
code carries it, and the response even returns `covenantId`) but does not persist the binding,
so `authenticateDevice` re-derives it with `findFirst({ subjectId, status: in [ACTIVE, REVOKED] },
orderBy: createdAt desc)`.

Result: a man pairs his phone under a covenant with ally A, revokes, forms a new covenant with
ally B — and the existing device keeps reporting, now to B, with no re-pairing and no consent
moment about that device. The covenant is the consent artifact; a device must not outlive it.

- Add `covenantId` to `Device`, set it inside the registration transaction.
- Match on it in `authenticateDevice` rather than re-deriving.
- When a covenant is revoked, mark its devices `RETIRED`.

### 1.3 Invitations to a new ally are never emailed

`sendInvite()` in `apps/web/lib/covenant.ts` routes through `notify()`, which needs a `userId`
because it writes an in-app row first. An ally who has never signed in has no `User` row, so
the function returns before any mail is attempted:

```ts
const user = await prisma.user.findUnique({ where: { email: covenant.inviteEmail }, ... });
if (!user) return;   // ← nothing is sent
```

An invite to a stranger is not a notification; it is an email to someone who is not a user yet.

```ts
export async function sendInvite(covenant: Covenant, subjectName: string): Promise<void> {
  if (!covenant.inviteEmail) return;
  const body = COPY.covenantInvited(subjectName, inviteUrl(covenant.inviteToken));
  const subject = "Ẹ̀rí — you have been asked to be an ally";

  const user = await prisma.user.findUnique({
    where: { email: covenant.inviteEmail }, select: { id: true },
  });

  if (user) {
    await notify({ userId: user.id, kind: "COVENANT_INVITED", body, covenantId: covenant.id, subject });
    return;
  }
  await sendMail({ to: covenant.inviteEmail, subject, text: body });
}
```

Also confirm the caller **awaits** `sendInvite` — a floating promise in a server action is
killed when the response returns, producing the same silence.

### 1.4 Failed sends are invisible

`sendMail` returns `false` on failure and nobody checks it. The `/subject` waiting screen says
*"send him this link if he did not get the email"* without showing which address it went to.

- Render `covenant.inviteEmail` and the invite expiry on the waiting screen:
  *"Invitation sent to name@example.com, expires 25 August."*
- Record delivery outcome and surface a plain warning when a send failed. An invisible failure
  is worse than a loud one.

### 1.5 Housekeeping

- Set `CRISIS_LINE_NAME` / `CRISIS_LINE_CONTACT` for the UAE, and make `lib/env.ts` refuse to
  boot in production without them. The current default is UK Samaritans, which will not connect
  for the launch audience.
- Delete the stray `/public/` directory at the repo root (a duplicate of the brand kit).
- Re-run `npm run acceptance` with `ANTHROPIC_API_KEY` set. Criterion 7 has only ever passed on
  the fallback path; the generated question has never run.

---

## 2. Before any native code: the platform reality

Read this before designing anything, because half of what seems obvious is not permitted.

### iOS cannot screenshot other apps. At all.

There is no API. Screen Time's `FamilyControls` hands you **opaque `ApplicationToken`s** — you
can shield an app but you are never told which app it is, and `DeviceActivityReport` extensions
run sandboxed with no network access, by design. The only route to actual pixels is a ReplayKit
**Broadcast Upload Extension**, which runs with a permanent recording indicator, a hard memory
ceiling around 50MB, and requires the user to start each broadcast manually.

**iOS v1 is Tier A. This is decided — build it, and do not build Tier B.**

**Tier A — filter and shield (the v1 build).**
`NEFilterDataProvider` content filter plus `FamilyControls` / `ManagedSettings` shields, with
the Screen Time PIN held by the ally. Events are `BLOCKED_ATTEMPT` — the confession window opens
on *attempts*, not on views. No image classification, because a content filter sees flow
metadata, not pixels. Less complete, far less intrusive, no recording indicator, and it pairs
well with iOS 26.4 gating Screen Time permission revocation behind the PIN. This gives real
enforcement on iPhone for the first time.

**Tier B — broadcast capture. Not in scope.**
Full-screen frames via ReplayKit, classified on-device. Complete, but: permanent recording
indicator, manual start every session, dies on reboot and on some interruptions. This is why
existing iOS accountability apps feel clunky. It was considered and rejected for v1.

Structure the code so Tier B could be added as a second extension target later rather than a
rewrite — but do not build it, do not stub it, and do not request its entitlement now.

**The consequence to design around honestly:** iOS and Android produce different event
vocabularies. Android yields real classified categories; iOS yields `BLOCKED_ATTEMPT` and
nothing else, and a man on iOS can reach material by a path the filter does not cover, producing
no event at all. An ally must never read a quiet iOS timeline as evidence that his friend is
doing well. Say so plainly on the devices page and in the ally's guidance copy: on iPhone, Ẹ̀rí
reports attempts it blocked, not everything that happened.

### Android can capture, but it is getting harder, not easier

- `MediaProjection`: since **Android 15** the user must grant permission on **every new
  session** — the token cannot be cached across restarts. A persistent notification is mandatory.
- `AccessibilityService` is closing as a workaround: **Advanced Protection Mode** revokes it
  from any app not classified as an accessibility tool, and the user cannot re-grant it while
  that mode is on. **Do not build on AccessibilityService.** Use `UsageStatsManager` for
  foreground-app signals instead.
- Google Play permits this only as **disclosed, consented monitoring**. The persistent
  notification and the in-app disclosure are policy requirements, not just good manners.

The re-consent gap after reboot is not a bug to engineer around. It produces a heartbeat gap,
which the platform already reports as silence. That is the design working.

---

## 3. Phase 2 — the sentinels

Both sentinels are clients of the **existing** protocol. Do not change
`packages/protocol` except to add what is genuinely missing; `docs/PROTOCOL.md` is the contract
and the whole point of phase 1 was that this is now a transcription job.

Each sentinel must:

1. Register once by exchanging a pairing code (`POST /api/v1/sentinel/register`), generating an
   Ed25519 keypair whose private half never leaves the device.
2. Sign every request over canonical JSON (`packages/protocol/src/canonical.ts` — sorted keys,
   no whitespace, signature covers `kind` so an envelope cannot be replayed at another endpoint).
3. Heartbeat every 15 minutes (`HEARTBEAT_INTERVAL_MINUTES`).
4. Classify **on-device**, discard the frame immediately, and transmit only category,
   confidence, classifier version and timestamp.
5. Show the subject the confession prompt **locally**, the moment an event fires — he must not
   have to open the web app to learn his window is open.
6. Emit antecedent signals (`LATE_HOUR`, `LONG_IDLE_UNLOCK`, `RAPID_APP_SWITCH`,
   `OFF_CHARGER_OVERNIGHT`).

Keep both sentinels **small and boring**. Minimal UI, few dependencies, no framework churn.
They have to survive OS updates for years, so give them as little surface area as possible. All
reflective surfaces — journal, rhythm, patterns, the ally view — stay on the web app.

### 3.1 Android — `apps/android-sentinel`

Kotlin. `minSdk 29`, target the current SDK.

- **Foreground service**, `foregroundServiceType="mediaProjection"`, persistent non-dismissable
  notification worded plainly: *"Ẹ̀rí is running. You installed this."*
- **Capture**: sample rather than stream. Do not screenshot continuously — budget battery.
  Trigger on foreground-app change (`UsageStatsManager`) plus a low-frequency timer while the
  screen is on. Downscale to the classifier's input size immediately; never write a frame to
  disk; never hold more than one in memory.
- **Classifier**: TFLite / MediaPipe image classifier, bundled. Version it and send
  `classifierVersion` with every event — you will retune thresholds and must know which version
  produced which event.
- **Keys**: Ed25519 in the Android Keystore where the OS version supports it; otherwise a
  Keystore-wrapped encrypted key file. Never plaintext, never backed up — set
  `allowBackup="false"` and exclude the key from auto-backup.
- **Heartbeat**: `WorkManager` periodic work at 15 minutes (the platform minimum, which matches
  the protocol).
- **Local prompt**: high-priority notification on event, opening a single screen with
  *"Tell him yourself"* and *"This was a false positive."* Both hit the web app's actions;
  do not duplicate the state machine on the device.
- **Re-consent**: after reboot, prompt for MediaProjection immediately and explain why. Until
  granted, keep heartbeating so the gap is honest — a device that is alive but not capturing
  must not look identical to one that is capturing.

### 3.2 iOS — `apps/ios-sentinel` (Tier A)

Swift. Three targets: the app, a `DeviceActivityMonitor` extension, and a
`NEFilterDataProvider` content-filter extension.

- **`FamilyControls`**: request authorisation, let the subject select categories/apps to shield
  via `FamilyActivityPicker`. Shields are configured through `ManagedSettings`.
- **Screen Time PIN is held by the ally**, not the subject. This is the enforcement mechanism —
  as of iOS 26.4, revoking the app's Screen Time permission requires that PIN.
- **Content filter**: `NEFilterDataProvider` decides on flows and reports blocked attempts.
  Note it sees metadata, not pixels — every event from this tier is `BLOCKED_ATTEMPT`.
- **App Group** for shared storage between app and extensions. The extensions are memory-limited;
  keep them minimal and let the containing app do the networking where possible.
- **Local prompt**: `UNUserNotificationCenter` on event, same two actions as Android.
- **Heartbeat**: `BGAppRefreshTask` is best-effort and will not reliably hit 15 minutes. Also
  heartbeat opportunistically from the extensions and on every app foreground, and treat the
  iOS silence thresholds as necessarily looser than Android's. Make the threshold
  platform-dependent rather than pretending iOS behaves like Android.
- **If Tier B is later approved**: add a Broadcast Upload Extension and use Apple's
  **`SensitiveContentAnalysis`** framework rather than bundling your own model — on-device,
  entitlement-gated, and a materially stronger position in App Review than a TFLite blob.

### 3.3 Protocol additions (only these)

- `Device.platformVersion` and `Device.osVersion` — you will need them for support triage.
- Platform-dependent silence thresholds, expressed in `packages/protocol`, not hardcoded server-side.
- Leave device attestation (App Attest / Play Integrity) as a documented TODO. It is the right
  answer to a stolen device key, but it is not a v1 problem and it is not free.

---

## 4. Rules that hold across everything

- **No content on the wire, ever.** If a change would let a reader reconstruct what was seen,
  it does not ship. The privacy check (`npm run check:privacy`) covers the schema and the
  protocol package — keep it passing and extend it to the native code's request builders.
- **No gamification.** No points, badges, streak flames, confetti. A rhythm that breaks is
  restorable, never a broken counter.
- **Ẹlẹ́rìí's scope is fixed.** Three jobs: draft the disclosure, write the ally's weekly
  question, name an antecedent pattern. He is a witness — he never counsels, diagnoses,
  absolves, or comments on content he does not have. Any sign of despair or self-harm stops the
  flow and surfaces a person. The tripwire in `lib/elerii/safety.ts` is code, not instruction;
  keep it that way.
- **Copy voice**: plain testimony. Sober, factual, unhurried. No exclamation marks, no
  encouragement-bot warmth, no congratulation.
- **Colour carries moral state**: `--steel` resting, `--sage` he disclosed himself, `--amber`
  window lapsed, `--alert` heartbeat lost. Never decorative. The mark itself never takes amber,
  sage or alert.
- **Record every open decision in `docs/DECISIONS.md`** as phase 1 did. That file is the review
  surface.

---

## 5. What Claude Code cannot do — Temi's list

Be explicit with Temi about these rather than working around them:

1. **Apple entitlements.** Family Controls (Distribution) must be requested per bundle ID, and
   **each extension is a separate approval**. For Tier A that is two requests — the app and the
   `DeviceActivityMonitor` extension — plus the NetworkExtension content-filter entitlement,
   which is a separate request again. No Broadcast Upload entitlement is needed, since Tier B is
   out of scope. Weeks of latency. Nothing native ships without these.
2. **Play Console declarations.** Foreground service type `mediaProjection` plus the sensitive
   permissions declaration. Google will want a demo video and a live privacy policy URL.
3. **Signing, provisioning, and physical device testing.** Claude Code cannot run Xcode, cannot
   drive a simulator, cannot install on a phone. It can write the Swift and Kotlin, structure the
   projects, and write the tests — but every build and every capture test is Temi's hands.
4. **The covenant terms** in `content/covenant-terms.md` are still marked `<!-- REVIEW: legal -->`.
   They describe what the software does, honestly, but no lawyer has read them. Given the UAE
   base and the nature of the data, this wants a real review before public launch.
5. **Store review positioning.** Both stores will ask what this is. The answer is a
   self-installed, mutually consented accountability tool between adults — not parental control,
   not employee monitoring. Get that language consistent across the listing, the privacy policy
   and the in-app copy.

## 6. Acceptance for phase 2

1. A real Android device registers with a pairing code and heartbeats for 24 hours unattended.
2. A detection on that device produces a `PENDING` event on the server, and the **local**
   notification arrives on the phone before anything reaches the ally.
3. Disclosing from the phone resolves the event and the ally is told he came forward.
4. Force-stopping the app raises a silence ALERT within the Android threshold.
5. Rebooting produces a re-consent prompt, and the gap is visible as silence rather than passing
   silently.
6. An iOS device shields a selected category, a blocked attempt produces a `BLOCKED_ATTEMPT`
   event, and revoking Screen Time permission requires the ally's PIN.
7. `npm run check:privacy` passes, extended to the native request builders.
8. No frame, image buffer, URL or app name appears in any request body, log line, or crash report.
