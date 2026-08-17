/**
 * POST /api/dev/simulator — the buttons on /simulator.
 *
 * Blocked in production, by 404 rather than by 403, so a production deployment
 * does not advertise that the route exists.
 *
 * Every action here goes out over HTTP to the real signed endpoints. If a
 * button works, the protocol works.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ANTECEDENT_KINDS, EVENT_CATEGORIES } from "@eri/protocol";

import { currentUserId } from "@/lib/auth";
import { lapseExpiredEvents } from "@/lib/events";
import { sweepSilences } from "@/lib/silence";
import { generateDueDigests } from "@/lib/digest";
import { simAntecedent, simDevices, simFire, simHeartbeat, simRegister, simulatorEnabled } from "@/lib/dev-simulator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("register"), pairingCode: z.string().min(6), label: z.string().max(64).optional() }),
  z.object({
    action: z.literal("fire"),
    deviceId: z.string(),
    category: z.enum(EVENT_CATEGORIES),
    confidence: z.number().min(0).max(1).optional(),
    at: z.string().optional(),
  }),
  z.object({ action: z.literal("heartbeat"), deviceId: z.string() }),
  z.object({ action: z.literal("antecedent"), deviceId: z.string(), kind: z.enum(ANTECEDENT_KINDS) }),
  z.object({ action: z.literal("sweep") }),
  z.object({ action: z.literal("devices") }),
]);

/** "01:14" → today at that time, or yesterday if that is still ahead of now. */
function wallClock(input: string): Date {
  const match = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  const now = new Date();
  if (!match) return now;
  const at = new Date(now);
  at.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (at.getTime() > now.getTime()) at.setDate(at.getDate() - 1);
  return at;
}

export async function POST(request: NextRequest) {
  if (!simulatorEnabled()) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "MALFORMED" }, { status: 400 });

  try {
    const input = parsed.data;

    switch (input.action) {
      case "register": {
        const result = await simRegister({ pairingCode: input.pairingCode, label: input.label ?? "Browser simulator" });
        return NextResponse.json({ ok: true, ...result, devices: simDevices() });
      }
      case "fire": {
        const result = await simFire({
          deviceId: input.deviceId,
          category: input.category,
          confidence: input.confidence ?? 0.82,
          occurredAt: input.at ? wallClock(input.at) : new Date(),
        });
        return NextResponse.json({ ok: true, ...result });
      }
      case "heartbeat":
        return NextResponse.json({ ok: true, ...(await simHeartbeat(input.deviceId)) });
      case "antecedent":
        await simAntecedent({ deviceId: input.deviceId, kind: input.kind });
        return NextResponse.json({ ok: true });
      case "sweep": {
        // Runs the same functions the cron route does, so a demo does not have
        // to wait ten minutes to watch a window lapse.
        const now = new Date();
        return NextResponse.json({
          ok: true,
          lapsed: await lapseExpiredEvents(now),
          silence: await sweepSilences(now),
          digests: await generateDueDigests(now),
        });
      }
      case "devices":
        return NextResponse.json({ ok: true, devices: simDevices() });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
