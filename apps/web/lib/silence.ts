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

import { silenceThresholdsFor } from "@eri/protocol";

import { COPY, notify } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

export type SilenceSweepResult = { opened: number; escalated: number; allyNotified: number };

export async function sweepSilences(now = new Date()): Promise<SilenceSweepResult> {
  const devices = await prisma.device.findMany({
    where: { status: { not: "RETIRED" } },
    select: {
      id: true,
      label: true,
      platform: true,
      subjectId: true,
      covenantId: true,
      lastHeartbeatAt: true,
      registeredAt: true,
      silences: { where: { endedAt: null }, orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  const result: SilenceSweepResult = { opened: 0, escalated: 0, allyNotified: 0 };

  for (const device of devices) {
    // Thresholds are per-platform. iOS cannot hold a 15-minute cadence — its
    // background refresh is scheduled by the system — so holding an iPhone to
    // Android's window would cry wolf on a device behaving exactly as Apple
    // intends, and an ally who learns to ignore silence alerts ignores the one
    // that matters. See packages/protocol/src/categories.ts.
    const thresholds = silenceThresholdsFor(device.platform);
    const warningCutoff = new Date(now.getTime() - thresholds.warningAfterMinutes * 60_000);
    const alertCutoff = new Date(now.getTime() - thresholds.alertAfterMinutes * 60_000);

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

    // The covenant this device was bound to at registration, by id. A device
    // belonging to an ended covenant must not raise an alert to the ally of a
    // newer one.
    const covenant = await prisma.covenant.findUnique({
      where: { id: device.covenantId },
      select: { id: true, allyId: true, status: true },
    });
    if (covenant?.status !== "ACTIVE" || !covenant.allyId) continue;

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
