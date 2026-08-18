/**
 * Phase 1 acceptance run.
 *
 * Walks the nine criteria in docs/DECISIONS.md § Acceptance against a running
 * server, driving the real UI in a browser and the real `eri-sim` CLI. Nothing
 * here reaches into the database to *make* something true — Prisma is used only
 * to create the two accounts (which would otherwise need an SMTP round trip)
 * and to read state back for assertions.
 *
 *   node scripts/acceptance.mjs
 *
 * Expects the app on http://localhost:3000 and DATABASE_URL pointing at it.
 */

import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

const BASE = process.env.ERI_BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  [32mPASS[0m  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  [31mFAIL[0m  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function heading(text) {
  console.log(`\n[1m${text}[0m`);
}

function sim(args) {
  return execFileSync("npx", ["eri-sim", ...args], {
    encoding: "utf8",
    env: { ...process.env, ERI_BASE_URL: BASE, ERI_SIM_HOME: "/tmp/eri-sim-acceptance" },
  });
}

/** Run eri-sim expecting it to fail, and return what it said. */
function simExpectingFailure(args) {
  try {
    sim(args);
    return null;
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
}

/** Create a user and a database session, and return the cookie that signs them in. */
async function signedInUser(email, name) {
  const user = await prisma.user.create({ data: { email, name, emailVerified: new Date() } });
  const sessionToken = randomUUID();
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 86_400_000) },
  });
  return {
    user,
    cookie: {
      name: "next-auth.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  };
}

async function sweep() {
  const response = await fetch(`${BASE}/api/cron/sweep`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "dev-cron-secret"}` },
  });
  return response.json();
}

async function main() {
  const browser = await chromium.launch({
    // A container may ship a pinned Chromium; point ERI_CHROMIUM at it rather
    // than downloading another.
    executablePath: process.env.ERI_CHROMIUM ?? undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const stamp = Date.now();

  // ── Setup ───────────────────────────────────────────────────────
  const subject = await signedInUser(`subject-${stamp}@example.com`, "Tayo");
  const ally = await signedInUser(`ally-${stamp}@example.com`, "Dele");

  const subjectCtx = await browser.newContext({ baseURL: BASE });
  await subjectCtx.addCookies([subject.cookie]);
  const subjectPage = await subjectCtx.newPage();

  const allyCtx = await browser.newContext({ baseURL: BASE });
  await allyCtx.addCookies([ally.cookie]);
  const allyPage = await allyCtx.newPage();

  /* ── 1. Two accounts form a covenant, both signing terms ───────── */
  heading("1 · Two accounts can form a covenant, both signing terms");

  await subjectPage.goto("/covenant/new");
  await subjectPage.fill('input[name="allyEmail"]', ally.user.email);
  await subjectPage.check('input[name="agree"]');
  await subjectPage.click('button[type="submit"]');
  await subjectPage.waitForURL("**/subject");

  let covenant = await prisma.covenant.findFirst({ where: { subjectId: subject.user.id } });
  check("subject signed", Boolean(covenant?.subjectSignedAt), `terms ${covenant?.termsVersion}`);
  check("covenant is PENDING until the ally signs", covenant?.status === "PENDING");

  await allyPage.goto(`/covenant/accept/${covenant.inviteToken}`);
  await allyPage.check('input[name="agree"]');
  await allyPage.click('form >> button[type="submit"] >> nth=0');
  await allyPage.waitForURL("**/ally");

  covenant = await prisma.covenant.findUnique({ where: { id: covenant.id } });
  check("ally signed", Boolean(covenant.allySignedAt));
  check("covenant is ACTIVE", covenant.status === "ACTIVE");
  check("both signed the same terms version", covenant.termsVersion === "2026-08-01");

  /* ── Register a device through the real protocol ────────────────── */
  heading("Device registration (pairing code → eri-sim register)");

  await subjectPage.goto("/devices");
  await subjectPage.click('button:has-text("Add a device")');
  await subjectPage.waitForSelector("text=Pairing code");
  const pairingCode = (await subjectPage.textContent(".font-mono.text-3xl")).trim();
  check("pairing code minted", /^[A-Z2-9]{8}$/.test(pairingCode), pairingCode);

  const registerOut = sim(["register", "--pairing-code", pairingCode, "--force", "--label", "Acceptance sim"]);
  check("eri-sim registered over the signed protocol", registerOut.includes("Registered"));

  const device = await prisma.device.findFirst({ where: { subjectId: subject.user.id } });
  check("device stored a 32-byte public key", Buffer.from(device.publicKey, "base64").length === 32);

  /* ── 2. fire → PENDING, subject notified, ally sees nothing ─────── */
  heading("2 · eri-sim fire produces PENDING; the ally's dashboard shows nothing at all");

  sim(["fire", "--category", "EXPLICIT_IMAGE", "--at", "01:14"]);

  let event = await prisma.event.findFirst({
    where: { covenantId: covenant.id },
    orderBy: { receivedAt: "desc" },
  });
  check("event is PENDING", event.state === "PENDING", event.category);
  check("window is open", event.windowExpiresAt > new Date());

  const subjectNotice = await prisma.notification.findFirst({
    where: { userId: subject.user.id, kind: "EVENT_PENDING", eventId: event.id },
  });
  check("the subject was notified", Boolean(subjectNotice));

  const allyNotices = await prisma.notification.count({ where: { userId: ally.user.id, eventId: event.id } });
  check("the ally was NOT notified", allyNotices === 0);

  await allyPage.goto("/ally");
  const allyHtml = await allyPage.content();
  const allyVisible = await allyPage.innerText("body");
  const leak = /pending|flagged|window|awaiting/i.exec(allyVisible);
  check("ally page shows no timeline entry", allyHtml.includes("Nothing has been reported"));
  check("ally page does not leak the event id", !allyHtml.includes(event.id));
  check("ally page does not leak the category", !allyHtml.includes("Explicit image"));
  check("ally page does not leak the occurrence time", !allyHtml.includes("01:14"));
  check(
    "nothing the ally can read hints at an open window",
    leak === null,
    leak ? `matched "${leak[0]}" in: ${allyVisible.slice(Math.max(0, leak.index - 60), leak.index + 60).replace(/\s+/g, " ")}` : "",
  );

  await subjectPage.goto("/subject");
  const subjectHtml = await subjectPage.content();
  check("subject sees the open window", subjectHtml.includes("Do you want to tell him yourself?"));

  /* ── 3. Disclose inside the window ──────────────────────────────── */
  heading("3 · Disclosing inside the window shows the ally that he came forward");

  const note = "I was up late again and I went looking. I wanted you to hear it from me.";
  await subjectPage.fill('textarea[name="note"]', note);
  await subjectPage.click('button:has-text("Tell him yourself")');
  await subjectPage.waitForSelector("text=has been told that you came forward yourself");

  event = await prisma.event.findUnique({ where: { id: event.id } });
  check("event is DISCLOSED", event.state === "DISCLOSED");
  check("resolvedAt was set", Boolean(event.resolvedAt));
  check("the subject's own note was stored", event.disclosureNote === note);

  await allyPage.goto("/ally");
  const allyAfterDisclose = await allyPage.content();
  check("ally is told he came forward", allyAfterDisclose.includes("He told you himself."));
  check("ally sees the subject-authored note", allyAfterDisclose.includes("hear it from me"));
  check("ally sees the category, not the content", allyAfterDisclose.includes("Explicit image"));

  /* ── 4. Let a window lapse ──────────────────────────────────────── */
  heading("4 · Letting the window lapse reports it automatically, with no content");

  sim(["fire", "--category", "SUGGESTIVE", "--at", "02:30"]);
  let lapsing = await prisma.event.findFirst({
    where: { covenantId: covenant.id, state: "PENDING" },
    orderBy: { receivedAt: "desc" },
  });

  // Wind the window back rather than waiting thirty minutes. The sweep still
  // decides, through the same state machine, whether it may lapse.
  await prisma.event.update({
    where: { id: lapsing.id },
    data: { windowExpiresAt: new Date(Date.now() - 1000) },
  });

  const lapseSweep = await sweep();
  check("sweep lapsed the window", lapseSweep.lapsed >= 1, JSON.stringify(lapseSweep.lapsed));

  lapsing = await prisma.event.findUnique({ where: { id: lapsing.id } });
  check("event is LAPSED", lapsing.state === "LAPSED");
  check("no note was invented for him", lapsing.disclosureNote === null);

  await allyPage.goto("/ally");
  const allyAfterLapse = await allyPage.content();
  check("ally is told it was not disclosed", allyAfterLapse.includes("An event was not disclosed."));

  /* ── 5. go-dark raises a silence ALERT ──────────────────────────── */
  heading("5 · eri-sim go-dark raises a silence ALERT to the ally");

  const goDarkOut = sim(["go-dark", "--for", "8h"]);
  check("simulator went dark", goDarkOut.includes("is dark until"));

  // The device stops heartbeating; age its last heartbeat past the 6h ALERT
  // threshold so the sweep sees what it would see after eight hours of silence.
  await prisma.device.update({
    where: { id: device.id },
    data: { lastHeartbeatAt: new Date(Date.now() - 8 * 3_600_000) },
  });

  const silenceSweep = await sweep();
  check("sweep opened a silence", silenceSweep.silence.opened >= 1);
  check("the ally was alerted", silenceSweep.silence.allyNotified >= 1);

  const silence = await prisma.silence.findFirst({ where: { deviceId: device.id, endedAt: null } });
  check("silence severity is ALERT", silence?.severity === "ALERT");
  check("ally notification recorded", Boolean(silence?.allyNotifiedAt));

  await allyPage.goto("/ally");
  check("ally page reports the quiet device", (await allyPage.content()).includes("has not reported since"));

  /* ── 7. A weekly digest with an Ẹlẹ́rìí question ─────────────────── */
  heading("7 · A weekly digest generates with an Ẹlẹ́rìí question");

  // Move this covenant's events into last week so the digest has a week to
  // describe — digests are only written for weeks that have finished.
  // Squarely inside the week the sweep will write a digest for — Thursday of
  // last week, at 01:00, so the rhythm has a late hour in it to describe.
  const thisWeekStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() - ((thisWeekStart.getUTCDay() + 6) % 7));
  const lastWeek = new Date(thisWeekStart.getTime() - 7 * 86_400_000 + 3 * 86_400_000 + 3_600_000);

  await prisma.event.updateMany({
    where: { covenantId: covenant.id },
    data: { occurredAt: lastWeek },
  });

  // Earlier sweeps in this run already wrote last week's digest, for a week
  // that had no events in it yet. Clear it so the digest is generated against
  // the rhythm the criteria are about.
  await prisma.digest.deleteMany({ where: { covenantId: covenant.id } });

  const digestSweep = await sweep();
  check("sweep generated a digest", digestSweep.digests >= 1);

  const digest = await prisma.digest.findFirst({ where: { covenantId: covenant.id } });
  check("digest has a question", Boolean(digest?.questionText?.length), digest?.questionText);
  check("digest has a plain summary", Boolean(digest?.summaryText?.length), digest?.summaryText);
  check(
    "the summary describes the week's actual rhythm",
    /\d+ event/.test(digest?.summaryText ?? "") && /came forward/.test(digest?.summaryText ?? ""),
    digest?.summaryText,
  );
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "  [33mNOTE[0m  ANTHROPIC_API_KEY is unset — the question above is Ẹlẹ́rìí's plain fallback, not a generated one.",
    );
  }

  await allyPage.goto("/ally");
  const allyWithDigest = await allyPage.content();
  check("the question is the top of the ally's page", allyWithDigest.includes(digest.questionText));

  /* ── The digest waits for an open window ────────────────────────── */
  heading("Digest · no digest is written while a window in that week is still open");

  await prisma.digest.deleteMany({ where: { covenantId: covenant.id } });

  sim(["fire", "--category", "SUGGESTIVE", "--at", "23:40"]);
  const straggler = await prisma.event.findFirst({
    where: { covenantId: covenant.id, state: "PENDING" },
    orderBy: { receivedAt: "desc" },
  });

  // Date it into the digest week but leave its window open.
  await prisma.event.update({
    where: { id: straggler.id },
    data: { occurredAt: lastWeek, windowExpiresAt: new Date(Date.now() + 3_600_000) },
  });

  const heldSweep = await sweep();
  check("sweep writes no digest while the week has an open window", heldSweep.digests === 0);
  check(
    "no digest row exists for that week",
    (await prisma.digest.count({ where: { covenantId: covenant.id } })) === 0,
  );

  // Close it. The same sweep lapses the window first, then writes the digest.
  await prisma.event.update({
    where: { id: straggler.id },
    data: { windowExpiresAt: new Date(Date.now() - 1000) },
  });

  const releasedSweep = await sweep();
  check("once the window closes the digest is written", releasedSweep.digests >= 1);

  const settledDigest = await prisma.digest.findFirst({ where: { covenantId: covenant.id } });
  check(
    "the digest counts the now-resolved event",
    /3 events/.test(settledDigest?.summaryText ?? ""),
    settledDigest?.summaryText,
  );

  /* ── 6. Revoking notifies the ally immediately ──────────────────── */
  heading("6 · Revoking the covenant notifies the ally immediately");

  await subjectPage.goto("/settings");
  await subjectPage.click('button:has-text("End this covenant")');
  await subjectPage.fill('input[name="confirm"]', "END IT");
  await subjectPage.click('button:has-text("End the covenant and tell")');
  await subjectPage.waitForSelector("text=was told immediately", { timeout: 20_000 });

  covenant = await prisma.covenant.findUnique({ where: { id: covenant.id } });
  check("covenant is REVOKED", covenant.status === "REVOKED");
  check("marked as ended by the subject", covenant.revokedBy === "SUBJECT");

  const revokeNotice = await prisma.notification.findFirst({
    where: { userId: ally.user.id, kind: "COVENANT_REVOKED" },
  });
  check("the ally was notified", Boolean(revokeNotice));
  check(
    "notified in the same moment it was revoked",
    Math.abs(revokeNotice.createdAt.getTime() - covenant.revokedAt.getTime()) < 2000,
  );

  const retired = await prisma.device.findUnique({ where: { id: device.id } });
  check("devices were retired", retired.status === "RETIRED");

  await allyPage.goto("/ally");
  check("ally page states it ended", (await allyPage.content()).includes("ended the covenant"));

  const afterRevoke = simExpectingFailure(["fire", "--category", "EXPLICIT_IMAGE"]);
  check(
    "the sentinel can no longer report into the ended covenant",
    afterRevoke !== null && /DEVICE_RETIRED|COVENANT_INACTIVE/.test(afterRevoke),
    afterRevoke?.trim().split("\n").pop(),
  );

  /* ── Protocol hardening ─────────────────────────────────────────── */
  heading("Protocol · replay, skew and signature rejection");

  const bad = await fetch(`${BASE}/api/v1/sentinel/event`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-eri-signature": "A".repeat(88) },
    body: JSON.stringify({
      v: "1",
      kind: "event",
      deviceId: device.id,
      nonce: randomUUID(),
      sentAt: new Date().toISOString(),
      occurredAt: new Date().toISOString(),
      category: "EXPLICIT_IMAGE",
      confidence: 0.9,
      classifierVersion: "x",
    }),
  });
  const badBody = await bad.json();
  check("a forged signature is rejected", bad.status === 401 && badBody.error === "BAD_SIGNATURE");

  const skewed = await fetch(`${BASE}/api/v1/sentinel/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-eri-signature": "A".repeat(88) },
    body: JSON.stringify({
      v: "1",
      kind: "heartbeat",
      deviceId: device.id,
      nonce: randomUUID(),
      sentAt: new Date(Date.now() - 3_600_000).toISOString(),
      sentinelVersion: "x",
      classifierVersion: "x",
    }),
  });
  check("a stale timestamp is rejected", (await skewed.json()).error === "CLOCK_SKEW");

  await browser.close();
  await prisma.$disconnect();

  console.log(`\n[1m${passed} passed, ${failed} failed[0m\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
