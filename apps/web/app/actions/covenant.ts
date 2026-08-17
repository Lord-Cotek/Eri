"use server";

/**
 * Covenant mutations.
 *
 * Every action re-derives the acting user from the session. Nothing here trusts
 * an id that arrived in a form field.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GRACE_WINDOW_MAX_MINUTES, GRACE_WINDOW_MIN_MINUTES } from "@eri/protocol";

import { currentUserId } from "@/lib/auth";
import {
  acceptCovenant,
  clampGraceWindow,
  createCovenant,
  declineCovenant,
  displayName,
  issuePairingCode,
  revokeCovenant,
  sendInvite,
  subjectCovenant,
} from "@/lib/covenant";
import { COPY, notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

export type ActionState = { error?: string; ok?: boolean; value?: string };

export async function createCovenantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Sign in first." };

  const agreed = formData.get("agree") === "on";
  if (!agreed) return { error: "You have to read and sign the terms before a covenant exists." };

  const allyEmail = String(formData.get("allyEmail") ?? "").trim().toLowerCase() || undefined;
  const grace = Number(formData.get("graceWindowMinutes") ?? 30);

  try {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const covenant = await createCovenant({ subjectId: userId, allyEmail, graceWindowMinutes: grace });
    await sendInvite(covenant, displayName(me));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not start the covenant." };
  }

  revalidatePath("/subject");
  redirect("/subject");
}

export async function acceptCovenantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Sign in first." };

  const token = String(formData.get("token") ?? "");
  if (formData.get("agree") !== "on") {
    return { error: "You have to read and sign the terms before you are anybody's ally." };
  }

  const result = await acceptCovenant({ token, allyId: userId });
  if (!result.ok) return { error: result.reason };

  revalidatePath("/ally");
  redirect("/ally");
}

export async function declineCovenantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Sign in first." };

  const result = await declineCovenant({ token: String(formData.get("token") ?? ""), allyId: userId });
  if (!result.ok) return { error: result.reason };

  redirect("/");
}

/**
 * End the covenant.
 *
 * The confirmation copy on /settings states the notification before the button
 * is pressed, and `revokeCovenant` sends it in the same transaction. There is
 * no arrangement of these two facts under which a man ends this quietly.
 */
export async function revokeCovenantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Sign in first." };

  const covenantId = String(formData.get("covenantId") ?? "");
  const typed = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (typed !== "END IT") return { error: 'Type "END IT" to confirm.' };

  try {
    await revokeCovenant({ covenantId, actorId: userId });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not end the covenant." };
  }

  revalidatePath("/settings");
  revalidatePath("/subject");
  revalidatePath("/ally");
  return { ok: true };
}

/** Changing the grace window notifies the ally. That is stated on the form too. */
export async function setGraceWindowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Sign in first." };

  const requested = Number(formData.get("graceWindowMinutes"));
  if (!Number.isFinite(requested) || requested < GRACE_WINDOW_MIN_MINUTES || requested > GRACE_WINDOW_MAX_MINUTES) {
    return { error: `Choose between ${GRACE_WINDOW_MIN_MINUTES} and ${GRACE_WINDOW_MAX_MINUTES} minutes.` };
  }

  const covenant = await subjectCovenant(userId);
  if (!covenant) return { error: "You are not the subject of an open covenant." };

  const minutes = clampGraceWindow(requested);
  if (minutes === covenant.graceWindowMinutes) return { ok: true };

  await prisma.covenant.update({ where: { id: covenant.id }, data: { graceWindowMinutes: minutes } });

  if (covenant.allyId) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    await notify({
      userId: covenant.allyId,
      kind: "GRACE_WINDOW_CHANGED",
      body: COPY.graceWindowChanged(displayName(me), minutes),
      covenantId: covenant.id,
      subject: "Ẹ̀rí — the grace window changed",
    });
  }

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Mint a pairing code for a new device.
 *
 * Shown once, in his own browser, valid for fifteen minutes, single-use. It is
 * never emailed — an emailed pairing code is a pairing code in somebody else's
 * inbox.
 */
export async function issuePairingCodeAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Sign in first." };

  const covenant = await subjectCovenant(userId);
  if (!covenant) return { error: "Start a covenant before adding a device." };
  if (covenant.status !== "ACTIVE") return { error: "Your ally has not signed yet." };

  const { code } = await issuePairingCode(covenant.id);
  revalidatePath("/devices");
  return { ok: true, value: code };
}

export async function retireDeviceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Sign in first." };

  const deviceId = String(formData.get("deviceId") ?? "");
  const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { subjectId: true } });
  if (!device || device.subjectId !== userId) return { error: "That is not your device." };

  await prisma.device.update({
    where: { id: deviceId },
    data: { status: "RETIRED", retiredAt: new Date() },
  });

  revalidatePath("/devices");
  return { ok: true };
}
