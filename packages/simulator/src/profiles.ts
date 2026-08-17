/**
 * Behaviour profiles for the simulated sentinel.
 *
 * These exist to exercise the parts of the system that only show themselves
 * over time: ally fatigue, digest generation, silence detection. A profile is
 * a rough shape of a week, not a model of anybody.
 */

import type { AntecedentKind, EventCategory } from "@eri/protocol";

export const PROFILE_NAMES = ["quiet", "realistic", "stress", "flaky"] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];

export type Profile = {
  name: ProfileName;
  description: string;
  /** Expected events per week. Zero means heartbeats only. */
  eventsPerWeek: number;
  /** Expected antecedent signals per week. */
  antecedentsPerWeek: number;
  /**
   * Hours of the day the profile clusters into, local time. Weighted uniformly
   * across the listed hours — the late-night skew is expressed by which hours
   * are listed, not by a curve.
   */
  activeHours: number[];
  /** Probability a scheduled heartbeat is silently dropped. */
  heartbeatDropRate: number;
  categoryWeights: Partial<Record<EventCategory, number>>;
  antecedentWeights: Partial<Record<AntecedentKind, number>>;
};

export const PROFILES: Record<ProfileName, Profile> = {
  quiet: {
    name: "quiet",
    description: "Heartbeats only. Proves the system is quiet when there is nothing to say.",
    eventsPerWeek: 0,
    antecedentsPerWeek: 2,
    activeHours: [23, 0, 1],
    heartbeatDropRate: 0,
    categoryWeights: {},
    antecedentWeights: { LATE_HOUR: 1, OFF_CHARGER_OVERNIGHT: 1 },
  },
  realistic: {
    name: "realistic",
    description: "A few events a week, clustered late at night. The default.",
    eventsPerWeek: 3,
    antecedentsPerWeek: 8,
    activeHours: [22, 23, 0, 1, 2],
    heartbeatDropRate: 0.02,
    categoryWeights: {
      EXPLICIT_IMAGE: 5,
      EXPLICIT_VIDEO: 2,
      SUGGESTIVE: 3,
      BLOCKED_ATTEMPT: 2,
      EXPLICIT_TEXT: 1,
      UNKNOWN: 1,
    },
    antecedentWeights: {
      LATE_HOUR: 4,
      OFF_CHARGER_OVERNIGHT: 3,
      LONG_IDLE_UNLOCK: 2,
      RAPID_APP_SWITCH: 2,
    },
  },
  stress: {
    name: "stress",
    description: "Many events. Tests ally fatigue, digest volume, and whether the rhythm still reads.",
    eventsPerWeek: 40,
    antecedentsPerWeek: 40,
    activeHours: [20, 21, 22, 23, 0, 1, 2, 3],
    heartbeatDropRate: 0.05,
    categoryWeights: {
      EXPLICIT_IMAGE: 6,
      EXPLICIT_VIDEO: 4,
      SUGGESTIVE: 4,
      BLOCKED_ATTEMPT: 3,
      EXPLICIT_TEXT: 2,
      UNKNOWN: 2,
    },
    antecedentWeights: {
      LATE_HOUR: 5,
      OFF_CHARGER_OVERNIGHT: 4,
      LONG_IDLE_UNLOCK: 3,
      RAPID_APP_SWITCH: 4,
    },
  },
  flaky: {
    name: "flaky",
    description: "Drops heartbeats. Proves silence is detected without the device being gone.",
    eventsPerWeek: 2,
    antecedentsPerWeek: 4,
    activeHours: [22, 23, 0, 1],
    heartbeatDropRate: 0.55,
    categoryWeights: { EXPLICIT_IMAGE: 3, SUGGESTIVE: 2, UNKNOWN: 1 },
    antecedentWeights: { LATE_HOUR: 2, LONG_IDLE_UNLOCK: 1 },
  },
};

export function isProfileName(value: string): value is ProfileName {
  return (PROFILE_NAMES as readonly string[]).includes(value);
}

/** Pick a key from a weight map. Weights need not sum to anything. */
export function weightedPick<K extends string>(weights: Partial<Record<K, number>>): K {
  const entries = Object.entries(weights) as [K, number][];
  if (entries.length === 0) throw new Error("weightedPick: empty weight map");
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1]![0];
}

/**
 * Per-tick probability of an event, given a weekly rate.
 *
 * The run loop ticks once per heartbeat interval, but only ticks landing in an
 * active hour can produce an event — so the weekly rate is spread across just
 * those ticks, not all of them.
 */
export function perTickProbability(ratePerWeek: number, profile: Profile, tickMinutes: number): number {
  if (ratePerWeek === 0) return 0;
  const ticksPerWeek = (7 * 24 * 60) / tickMinutes;
  const activeFraction = profile.activeHours.length / 24;
  const activeTicksPerWeek = ticksPerWeek * activeFraction;
  return Math.min(1, ratePerWeek / activeTicksPerWeek);
}
