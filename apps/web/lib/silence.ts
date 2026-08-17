/**
 * Silence detection.
 *
 * You cannot make an app un-uninstallable. Ẹ̀rí does not try. It makes the
 * absence reportable instead, and that is the honest version of the promise
 * every product in this category quietly breaks.
 *
 * Two thresholds: 60 minutes is a WARNING and stays between the man and his own
 * devices page; 6 hours is an ALERT and the ally is told. The gap between them
 * is deliberate — a flat battery should not summon anybody.
 */

import "server-only";

import { SILENCE_ALERT_AFTER_MINUTES, SILENCE_WARNING_AFTER_MINUTES } from "@eri/protocol";

import { COPY, notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

export type SilenceSweepResult = { opened: number; escalated: number; allyNotified: number };

export async function sweepSilences(now = new Date()): Promise<SilenceSweepResult> {
  const warningCutoff = new Date(now.getTime() - SILENCE_WARNING_AFTER_MINUTES * 60_000);
  const alertCutoff = new Date(now.getTime() - SILENCE_ALERT_AFTER_MINUTES * 60_000);

  const devices = await prisma.device.findMany({
    where: { status: { not: "RETIRED" } },
    select: {
      id: true,
      label: true,
      subjectId: true,
      lastHeartbeatAt: true,
      registeredAt: true,
      silences: { where: { endedAt: null }, orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  const result: SilenceSweepResult = { opened: 0, escalated: 0, allyNotified: 0 };

  for (const device of devices) {
    // A device that has never spoken is timed from registration, so a sentinel
    // that was installed and never ran is not invisible.
    const lastSeen = device.lastHeartbeatAt ?? device.registeredAt;
    if (lastSeen > warningCutoff) continue;

    const severity = lastSeen <= alertCutoff ? "ALERT" : "WARNING";
    const open = device.silences[0];

    if (!open) {
      await prisma.silence.create({ data: { deviceId: device.id, startedAt: lastSeen, severity } });
      await prisma.device.update({ where: { id: device.id }, data: { status: "SILENT" } });
      result.opened += 1;
    } else if (open.severity === "WARNING" && severity === "ALERT") {
      await prisma.silence.update({ where: { id: open.id }, data: { severity: "ALERT" } });
      result.escalated += 1;
    }

    if (severity !== "ALERT") continue;

    // Re-read so an escalation in this same pass is included.
    const silence = await prisma.silence.findFirst({
      where: { deviceId: device.id, endedAt: null, severity: "ALERT" },
      orderBy: { startedAt: "desc" },
    });
    if (!silence || silence.allyNotifiedAt) continue;

    const covenant = await prisma.covenant.findFirst({
      where: { subjectId: device.subjectId, status: "ACTIVE" },
      select: { id: true, allyId: true },
    });
    if (!covenant?.allyId) continue;

    // Claim before notifying, so two overlapping sweeps cannot double-alert.
    const claimed = await prisma.silence.updateMany({
      where: { id: silence.id, allyNotifiedAt: null },
      data: { allyNotifiedAt: now },
    });
    if (claimed.count === 0) continue;

    await notify({
      userId: covenant.allyId,
      kind: "SILENCE_ALERT",
      body: COPY.silenceAlert(device.label, now.getTime() - lastSeen.getTime()),
      covenantId: covenant.id,
      subject: "Ẹ̀rí — a device has gone quiet",
    });
    result.allyNotified += 1;
  }

  return result;
}
