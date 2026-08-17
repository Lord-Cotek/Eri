/** A very small flag parser. The simulator has no runtime dependencies beyond the protocol. */

export type Args = {
  command: string;
  flags: Record<string, string | true>;
};

export function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const flags: Record<string, string | true> = {};

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!;
    if (!token.startsWith("--")) continue;
    const eq = token.indexOf("=");
    if (eq !== -1) {
      flags[token.slice(2, eq)] = token.slice(eq + 1);
      continue;
    }
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[token.slice(2)] = true;
    } else {
      flags[token.slice(2)] = next;
      i++;
    }
  }

  return { command, flags };
}

export function str(flags: Args["flags"], name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

export function requireStr(flags: Args["flags"], name: string): string {
  const value = str(flags, name);
  if (!value) throw new Error(`Missing required flag --${name}`);
  return value;
}

export function num(flags: Args["flags"], name: string): number | undefined {
  const value = str(flags, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a number`);
  return parsed;
}

export function bool(flags: Args["flags"], name: string): boolean {
  return flags[name] === true || flags[name] === "true";
}

/** Parse "8h", "90m", "45s", "2d" into milliseconds. */
export function parseDuration(input: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(s|m|h|d)$/i.exec(input.trim());
  if (!match) throw new Error(`Cannot read duration "${input}". Use forms like 30m, 8h, 2d.`);
  const value = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const scale = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return value * scale;
}

/**
 * Parse a wall-clock "HH:MM" into an instant.
 *
 * Interpreted as local time. If that instant is still in the future today it is
 * read as yesterday, because a sentinel reports what already happened — you
 * cannot detect something at 23:50 at nine in the morning.
 */
export function parseWallClock(input: string, now = new Date()): Date {
  const match = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (!match) throw new Error(`Cannot read time "${input}". Use HH:MM, e.g. 01:14.`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`"${input}" is not a valid time of day.`);

  const at = new Date(now);
  at.setHours(hours, minutes, 0, 0);
  if (at.getTime() > now.getTime()) at.setDate(at.getDate() - 1);
  return at;
}
