/**
 * The covenant: forming it, joining it, ending it.
 *
 * Two invariants live here rather than in the routes, so no route can forget
 * them:
 *
 *   - A covenant is only ACTIVE once *both* men have signed the same terms
 *     version. One-sided consent is not consent.
 *   - Revocation notifies the other man in the same transaction that records
 *     it. There is no code path that ends a covenant quietly.
 */

import "server-only";

import { randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ActorRole, Covenant } from "@prisma/client";
import { GRACE_WINDOW_DEFAULT_MINUTES, GRACE_WINDOW_MAX_MINUTES, GRACE_WINDOW_MIN_MINUTES } from "@eri/protocol";

import { prisma } from "@/lib/prisma";
import { COPY, notify } from "@/lib/notify";

/**
 * The version of `content/covenant-terms.md` currently in force.
 *
 * Bump this whenever that file changes. Each man's signature is recorded
 * against the version he read, and a later revision is never applied to him
 * retroactively.
 */
export const TERMS_VERSION = "2026-08-01";

const INVITE_TTL_MS = 7 * 86_400_000;
const PAIRING_TTL_MS = 15 * 60_000;

let cachedTerms: string | null = null;

/** The covenant terms, as authored. Read from disk once. */
export function covenantTerms(): string {
  cachedTerms ??= readFileSync(join(process.cwd(), "content", "covenant-terms.md"), "utf8");
  return cachedTerms;
}

/* ------------------------------------------------------------------ */
/* Forming                                                             */
/* ------------------------------------------------------------------ */

export type CreateCovenantInput = {
  subjectId: string;
  allyEmail?: string;
  graceWindowMinutes?: number;
};

export async function createCovenant(input: CreateCovenantInput): Promise<Covenant> {
  const existing = await prisma.covenant.findFirst({
    where: { subjectId: input.subjectId, status: { in: ["PENDING", "ACTIVE"] } },
  });
  if (existing) throw new Error("You already have a covenant open. End it before starting another.");

  return prisma.covenant.create({
    data: {
      subjectId: input.subjectId,
      status: "PENDING",
      termsVersion: TERMS_VERSION,
      subjectSignedAt: new Date(),
      graceWindowMinutes: clampGraceWindow(input.graceWindowMinutes ?? GRACE_WINDOW_DEFAULT_MINUTES),
      inviteToken: randomBytes(24).toString("base64url"),
      inviteEmail: input.allyEmail ?? null,
      inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
}

export function clampGraceWindow(minutes: number): number {
  if (!Number.isFinite(minutes)) return GRACE_WINDOW_DEFAULT_MINUTES;
  return Math.min(GRACE_WINDOW_MAX_MINUTES, Math.max(GRACE_WINDOW_MIN_MINUTES, Math.round(minutes)));
}

export function inviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}/covenant/accept/${token}`;
}

export async function sendInvite(covenant: Covenant, subjectName: string): Promise<void> {
  if (!covenant.inviteEmail) return;
  const user = await prisma.user.findUnique({ where: { email: covenant.inviteEmail }, select: { id: true } });
  if (!user) return; // He is invited by link; there is nobody to notify in-app yet.

  await notify({
    userId: user.id,
    kind: "COVENANT_INVITED",
    body: COPY.covenantInvited(subjectName, inviteUrl(covenant.inviteToken)),
    covenantId: covenant.id,
    subject: "Ẹ̀rí — you have been asked to be an ally",
  });
}

/* ------------------------------------------------------------------ */
/* Joining                                                             */
/* ------------------------------------------------------------------ */

export type AcceptResult = { ok: true; covenantId: string } | { ok: false; reason: string };

/**
 * The ally signs.
 *
 * Both signatures must be against the same terms version. If the subject signed
 * an older revision, the covenant does not activate — the two men would be in
 * different agreements.
 */
export async function acceptCovenant(input: { token: string; allyId: string }): Promise<AcceptResult> {
  const covenant = await prisma.covenant.findUnique({
    where: { inviteToken: input.token },
    include: { subject: { select: { id: true, name: true, email: true } } },
  });

  if (!covenant) return { ok: false, reason: "That invitation does not exist." };
  if (covenant.status !== "PENDING") return { ok: false, reason: "That invitation has already been settled." };
  if (covenant.inviteExpiresAt < new Date()) return { ok: false, reason: "That invitation has expired." };
  if (covenant.subjectId === input.allyId) return { ok: false, reason: "A man cannot be his own ally." };
  if (covenant.termsVersion !== TERMS_VERSION) {
    return { ok: false, reason: "The terms have changed since this invitation was sent. Ask him to send a new one." };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.covenant.update({
      where: { id: covenant.id },
      data: { allyId: input.allyId, allySignedAt: now, status: "ACTIVE", activatedAt: now },
    });

    const ally = await tx.user.findUnique({ where: { id: input.allyId }, select: { name: true, email: true } });

    await notify({
      userId: covenant.subjectId,
      kind: "COVENANT_ACTIVATED",
      body: COPY.covenantActivated(displayName(ally)),
      covenantId: covenant.id,
      subject: "Ẹ̀rí — your covenant is active",
      db: tx,
    });

    await notify({
      userId: input.allyId,
      kind: "COVENANT_ACTIVATED",
      body: COPY.covenantActivated(displayName(covenant.subject)),
      covenantId: covenant.id,
      subject: "Ẹ̀rí — your covenant is active",
      db: tx,
    });
  });

  return { ok: true, covenantId: covenant.id };
}

export async function declineCovenant(input: { token: string; allyId: string }): Promise<AcceptResult> {
  const covenant = await prisma.covenant.findUnique({ where: { inviteToken: input.token } });
  if (!covenant) return { ok: false, reason: "That invitation does not exist." };
  if (covenant.status !== "PENDING") return { ok: false, reason: "That invitation has already been settled." };

  await prisma.$transaction(async (tx) => {
    await tx.covenant.update({ where: { id: covenant.id }, data: { status: "DECLINED" } });
    const ally = await tx.user.findUnique({ where: { id: input.allyId }, select: { name: true, email: true } });
    await notify({
      userId: covenant.subjectId,
      kind: "COVENANT_DECLINED",
      body: COPY.covenantDeclined(displayName(ally)),
      covenantId: covenant.id,
      subject: "Ẹ̀rí — your invitation was declined",
      db: tx,
    });
  });

  return { ok: true, covenantId: covenant.id };
}

/* ------------------------------------------------------------------ */
/* Ending                                                              */
/* ------------------------------------------------------------------ */

/**
 * End a covenant.
 *
 * Consent is revocable but never silently. The notification is written inside
 * the same transaction as the revocation, so there is no window in which the
 * covenant is over and the other man does not know.
 */
export async function revokeCovenant(input: { covenantId: string; actorId: string }): Promise<void> {
  const covenant = await prisma.covenant.findUnique({
    where: { id: input.covenantId },
    include: {
      subject: { select: { id: true, name: true, email: true } },
      ally: { select: { id: true, name: true, email: true } },
    },
  });
  if (!covenant) throw new Error("No such covenant.");

  const isSubject = covenant.subjectId === input.actorId;
  const isAlly = covenant.allyId === input.actorId;
  if (!isSubject && !isAlly) throw new Error("You are not in this covenant.");
  if (covenant.status === "REVOKED") return;

  const role: ActorRole = isSubject ? "SUBJECT" : "ALLY";
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.covenant.update({
      where: { id: covenant.id },
      data: { status: "REVOKED", revokedAt: now, revokedBy: role },
    });

    // Retire the devices too. A sentinel that keeps reporting into an ended
    // covenant is reporting on a man who withdrew his consent.
    await tx.device.updateMany({
      where: { subjectId: covenant.subjectId, status: { not: "RETIRED" } },
      data: { status: "RETIRED", retiredAt: now },
    });

    const other = isSubject ? covenant.ally : covenant.subject;
    if (other) {
      await notify({
        userId: other.id,
        kind: "COVENANT_REVOKED",
        body: isSubject
          ? COPY.covenantRevoked(displayName(covenant.subject))
          : `${displayName(covenant.ally)} has stepped down as your ally.`,
        covenantId: covenant.id,
        subject: "Ẹ̀rí — the covenant has ended",
        db: tx,
      });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Pairing codes                                                       */
/* ------------------------------------------------------------------ */

/** Unambiguous alphabet — no O/0, no I/1/L. Read aloud between two phones. */
const PAIRING_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export async function issuePairingCode(covenantId: string): Promise<{ code: string; expiresAt: Date }> {
  const code = Array.from({ length: 8 }, () => PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)]).join("");
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await prisma.pairingCode.create({ data: { code, covenantId, expiresAt } });
  return { code, expiresAt };
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function displayName(user: { name?: string | null; email?: string | null } | null | undefined): string {
  if (!user) return "He";
  if (user.name) return user.name;
  if (user.email) return user.email.split("@")[0] ?? "He";
  return "He";
}

/** The covenant this man is the subject of, if any. */
export async function subjectCovenant(userId: string) {
  return prisma.covenant.findFirst({
    where: { subjectId: userId, status: { in: ["PENDING", "ACTIVE"] } },
    include: { ally: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * The most recently ended covenant this man was in, either side of it.
 *
 * Once a covenant is revoked it drops out of `subjectCovenant`, which would
 * otherwise leave a man who has just ended one looking at a page that says he
 * is not in a covenant — with no confirmation that his ally was told. Being
 * told is the one condition he agreed to, so he is shown that it happened.
 */
export async function endedCovenant(userId: string) {
  return prisma.covenant.findFirst({
    where: { status: "REVOKED", OR: [{ subjectId: userId }, { allyId: userId }] },
    include: {
      subject: { select: { id: true, name: true, email: true } },
      ally: { select: { id: true, name: true, email: true } },
    },
    orderBy: { revokedAt: "desc" },
  });
}

/** The covenant this man is the ally in, if any. */
export async function allyCovenant(userId: string) {
  return prisma.covenant.findFirst({
    where: { allyId: userId, status: { in: ["ACTIVE", "REVOKED"] } },
    include: { subject: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
}
