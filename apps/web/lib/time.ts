/**
 * Time formatting.
 *
 * Ẹ̀rí talks about times a lot and it must do so plainly. No "3 minutes ago!!",
 * no relative-time cuteness where a clock time is clearer. An event at 01:14 is
 * described as 01:14, because that is the fact.
 */

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function clockTime(date: Date): string {
  return TIME.format(date);
}

export function longDate(date: Date): string {
  return DAY.format(date);
}

export function shortDate(date: Date): string {
  return SHORT_DAY.format(date);
}

/** "Monday 4 August, 01:14" */
export function dayAndTime(date: Date): string {
  return `${longDate(date)}, ${clockTime(date)}`;
}

/** "11 minutes", "1 hour 4 minutes". Used for durations, never for countdowns. */
export function humanDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourPart = `${hours} hour${hours === 1 ? "" : "s"}`;
  if (minutes === 0) return hourPart;
  return `${hourPart} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** Monday 00:00 UTC of the week containing `date`. Digests are keyed on this. */
export function weekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local calendar-day key, for grouping a rhythm chart. */
export function dayKey(date: Date): string {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
