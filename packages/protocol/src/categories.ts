/**
 * Ẹ̀rí — protocol vocabulary.
 *
 * PRIVACY INVARIANT: every value in this file is a *coarse label*. None of it
 * describes what was seen. A category is the most the wire is ever allowed to
 * carry about the nature of an event. There is deliberately no "detail",
 * "subcategory", "source", "app" or "host" concept anywhere in this protocol.
 * See docs/PRIVACY-INVARIANTS.md.
 */

/** Coarse event categories. Never refined, never free-text. */
export const EVENT_CATEGORIES = [
  "EXPLICIT_IMAGE",
  "EXPLICIT_VIDEO",
  "EXPLICIT_TEXT",
  "SUGGESTIVE",
  "BLOCKED_ATTEMPT",
  "UNKNOWN",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** Human-facing labels. Plain, factual, no euphemism and no shame language. */
export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  EXPLICIT_IMAGE: "Explicit image",
  EXPLICIT_VIDEO: "Explicit video",
  EXPLICIT_TEXT: "Explicit text",
  SUGGESTIVE: "Suggestive",
  BLOCKED_ATTEMPT: "Blocked attempt",
  UNKNOWN: "Unclassified",
};

/** Lifecycle states of an event. Transitions are one-way. */
export const EVENT_STATES = ["PENDING", "DISCLOSED", "LAPSED", "CONTESTED"] as const;
export type EventState = (typeof EVENT_STATES)[number];

/**
 * Antecedent signals — pattern only, never content.
 *
 * These drive the *pre-emptive* nudge to the subject. They are never shown to
 * the ally individually; only aggregate rhythm reaches him.
 */
export const ANTECEDENT_KINDS = [
  "LATE_HOUR",
  "LONG_IDLE_UNLOCK",
  "RAPID_APP_SWITCH",
  "OFF_CHARGER_OVERNIGHT",
] as const;

export type AntecedentKind = (typeof ANTECEDENT_KINDS)[number];

export const ANTECEDENT_KIND_LABELS: Record<AntecedentKind, string> = {
  LATE_HOUR: "Late hour",
  LONG_IDLE_UNLOCK: "Unlocked after a long idle",
  RAPID_APP_SWITCH: "Rapid app switching",
  OFF_CHARGER_OVERNIGHT: "Off the charger overnight",
};

export const DEVICE_PLATFORMS = ["IOS", "ANDROID", "MACOS", "WINDOWS", "SIMULATOR"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const DEVICE_PLATFORM_LABELS: Record<DevicePlatform, string> = {
  IOS: "iPhone",
  ANDROID: "Android",
  MACOS: "Mac",
  WINDOWS: "Windows",
  SIMULATOR: "Simulator",
};

export const DEVICE_STATUSES = ["ACTIVE", "SILENT", "RETIRED"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const COVENANT_STATUSES = ["PENDING", "ACTIVE", "REVOKED", "DECLINED"] as const;
export type CovenantStatus = (typeof COVENANT_STATUSES)[number];

export const SILENCE_SEVERITIES = ["WARNING", "ALERT"] as const;
export type SilenceSeverity = (typeof SILENCE_SEVERITIES)[number];

/** Heartbeat cadence the sentinels are expected to keep, in minutes. */
export const HEARTBEAT_INTERVAL_MINUTES = 15;

/**
 * Silence thresholds, in minutes, applied by the sweep job.
 *
 * These are the Android and simulator figures, and they are the defaults. iOS
 * cannot meet them: `BGAppRefreshTask` is best-effort and the system decides
 * when — often not for hours, and never on a fixed 15-minute cadence. Holding
 * iPhone to Android's threshold would cry wolf on a device that is working
 * exactly as Apple intends, and an ally who learns to ignore silence alerts is
 * an ally who ignores the one that matters.
 *
 * So the thresholds are per-platform. They live here rather than in the server
 * so that a sentinel, the sweep job and the devices page all quote the same
 * numbers.
 */
export const SILENCE_WARNING_AFTER_MINUTES = 60;
export const SILENCE_ALERT_AFTER_MINUTES = 6 * 60;

export type SilenceThresholds = { warningAfterMinutes: number; alertAfterMinutes: number };

export const SILENCE_THRESHOLDS: Record<DevicePlatform, SilenceThresholds> = {
  ANDROID: { warningAfterMinutes: 60, alertAfterMinutes: 6 * 60 },
  SIMULATOR: { warningAfterMinutes: 60, alertAfterMinutes: 6 * 60 },
  MACOS: { warningAfterMinutes: 60, alertAfterMinutes: 6 * 60 },
  WINDOWS: { warningAfterMinutes: 60, alertAfterMinutes: 6 * 60 },
  /**
   * iOS is looser on purpose, not as a concession to sloppiness. Background
   * refresh is scheduled by the system; a phone that is idle overnight may not
   * run one for hours. The sentinel also heartbeats on every app foreground and
   * opportunistically from its extensions, so a genuinely removed app still
   * goes quiet — it just takes longer to be sure.
   */
  IOS: { warningAfterMinutes: 4 * 60, alertAfterMinutes: 18 * 60 },
};

export function silenceThresholdsFor(platform: DevicePlatform): SilenceThresholds {
  return SILENCE_THRESHOLDS[platform];
}

/**
 * What a platform's sentinel can actually observe.
 *
 * iOS Tier A is a content filter and a set of shields: it sees flow metadata,
 * never pixels, so every event it can produce is a BLOCKED_ATTEMPT. It cannot
 * see what a man reached by a route the filter does not cover, and it will
 * never report it.
 *
 * This is on the wire rather than in the web app's copy because it changes what
 * a quiet timeline *means*, and an ally reading one must be told which kind of
 * quiet he is looking at.
 */
export type PlatformCapability = {
  /** Categories this platform's sentinel can ever emit. */
  emits: readonly EventCategory[];
  /** True when absence of events implies little. */
  partialCoverage: boolean;
  /** One sentence, shown to the ally and on the devices page. */
  caveat: string | null;
};

export const PLATFORM_CAPABILITIES: Record<DevicePlatform, PlatformCapability> = {
  ANDROID: { emits: EVENT_CATEGORIES, partialCoverage: false, caveat: null },
  SIMULATOR: { emits: EVENT_CATEGORIES, partialCoverage: false, caveat: null },
  MACOS: { emits: EVENT_CATEGORIES, partialCoverage: false, caveat: null },
  WINDOWS: { emits: EVENT_CATEGORIES, partialCoverage: false, caveat: null },
  IOS: {
    emits: ["BLOCKED_ATTEMPT"],
    partialCoverage: true,
    caveat:
      "On iPhone, Ẹ̀rí reports attempts it blocked — not everything that happened. Apple gives no app sight of another app's screen. A quiet iPhone timeline is not evidence that a week went well.",
  },
};

/** Grace window bounds, in minutes. The subject may tune within this range. */
export const GRACE_WINDOW_MIN_MINUTES = 10;
export const GRACE_WINDOW_MAX_MINUTES = 60;
export const GRACE_WINDOW_DEFAULT_MINUTES = 30;

/** Maximum length of a subject-authored disclosure note. */
export const DISCLOSURE_NOTE_MAX_LENGTH = 500;

/** Requests older (or newer) than this are rejected as replays or clock skew. */
export const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

/** The wire protocol version. Bump on any breaking field change. */
export const PROTOCOL_VERSION = "1";
