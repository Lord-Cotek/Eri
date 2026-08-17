"use server";

/**
 * The ally's reply surface, in full.
 *
 * One button. "I saw it. I'm still here." It sends exactly that and nothing
 * else — there is no free-text reply here on purpose. An ally who wants to say
 * more should say it to his face, and the product should not make a comment box
 * feel like it counts.
 */

import { revalidatePath } from "next/cache";

import { currentUserId } from "@/lib/auth";
import { allyCovenant, displayName } from "@/lib/covenant";
import { COPY, notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/app/actions/covenant";

export async function stillHereAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Sign in first." };

  const covenant = await allyCovenant(userId);
  if (!covenant || covenant.status !== "ACTIVE") return { error: "You are not an ally in an open covenant." };

  const eventId = String(formData.get("eventId") ?? "") || null;
  const digestId = String(formData.get("digestId") ?? "") || null;
  if (!eventId && !digestId) return { error: "Nothing to acknowledge." };

  // An ack is attached to something inside this covenant, or to nothing.
  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { covenantId: true, state: true } });
    if (!event || event.covenantId !== covenant.id) return { error: "That is not in your covenant." };
    if (event.state === "PENDING") return { error: "There is nothing here to acknowledge." };
  }
  if (digestId) {
    const digest = await prisma.digest.findUnique({ where: { id: digestId }, select: { covenantId: true } });
    if (!digest || digest.covenantId !== covenant.id) return { error: "That is not in your covenant." };
  }

  const existing = await prisma.allyAck.findFirst({
    where: { allyId: userId, eventId, digestId, kind: "STILL_HERE" },
    select: { id: true },
  });
  if (existing) return { ok: true };

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });

  await prisma.$transaction(async (tx) => {
    await tx.allyAck.create({ data: { allyId: userId, eventId, digestId, kind: "STILL_HERE" } });
    await notify({
      userId: covenant.subjectId,
      kind: "ALLY_ACK",
      body: COPY.allyAck(displayName(me)),
      eventId: eventId ?? undefined,
      covenantId: covenant.id,
      digestId: digestId ?? undefined,
      subject: "Ẹ̀rí",
      db: tx,
    });
  });

  revalidatePath("/ally");
  revalidatePath("/subject");
  return { ok: true };
}

export async function markDigestReadAction(digestId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const covenant = await allyCovenant(userId);
  if (!covenant) return;

  await prisma.digest.updateMany({
    where: { id: digestId, covenantId: covenant.id, readAt: null },
    data: { readAt: new Date() },
  });
}
