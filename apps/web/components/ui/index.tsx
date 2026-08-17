/**
 * The Ẹ̀rí UI kit — the COTEK kit, tuned sober.
 *
 * Two rules the components enforce rather than merely suggest:
 *
 *   - The accent is `steel`, not amber. Amber is reserved for a lapsed window
 *     and appears nowhere else, so it never reads as ordinary chrome.
 *   - There is no gamification primitive here. No badge, no streak flame, no
 *     progress ring, no confetti. If a rhythm breaks it is restorable, and a
 *     component that renders it as a broken counter would be lying about that.
 */

import Link from "next/link";

/* ------------------------------------------------------------------ */
/* Eyebrow                                                             */
/* ------------------------------------------------------------------ */

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

/**
 * Moral state, and nothing else, decides the tone.
 *
 * `neutral` is the overwhelming default. If you are reaching for a tone, check
 * that the thing you are rendering really is a disclosure, a lapse or a lost
 * heartbeat — those three, and nothing that merely resembles them.
 */
export type Tone = "neutral" | "steel" | "sage" | "amber" | "alert";

const TONE_BORDER: Record<Tone, string> = {
  neutral: "border-border",
  steel: "border-steel/40",
  sage: "border-sage/40",
  amber: "border-amber/40",
  alert: "border-alert/40",
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted",
  steel: "text-steel",
  sage: "text-sage",
  amber: "text-amber",
  alert: "text-alert",
};

export function Card({
  children,
  className = "",
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return <div className={`border bg-surface ${TONE_BORDER[tone]} ${className}`}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* StatCard                                                            */
/* ------------------------------------------------------------------ */

/**
 * A figure and what it means.
 *
 * `note` is a plain sentence, not a delta — Ẹ̀rí does not show a man whether he
 * is up or down on last week. That framing turns a covenant into a scoreboard.
 */
export function StatCard({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: Tone;
}) {
  return (
    <div className="border border-border bg-bg p-6">
      <p className="eyebrow">{label}</p>
      <p className={`mt-3 font-serif text-3xl ${tone === "neutral" ? "text-ink" : TONE_TEXT[tone]}`}>{value}</p>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "quiet" | "danger";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
};

const BASE =
  "inline-flex items-center justify-center px-5 py-2.5 text-sm transition-colors duration-200 ease-editorial disabled:opacity-40 disabled:cursor-not-allowed";

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  /** The one action a screen actually wants. Steel — never amber. */
  primary: "border border-steel text-steel hover:bg-steel hover:text-bg",
  ghost: "border border-border text-muted hover:border-ink hover:text-ink",
  quiet: "text-muted hover:text-ink underline-offset-4 hover:underline px-0",
  /** Ending a covenant. Deliberately unattractive, never hidden. */
  danger: "border border-alert/50 text-alert hover:bg-alert hover:text-bg",
};

export function Button({
  children,
  href,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  disabled,
  title,
}: ButtonProps) {
  const cls = `${BASE} ${VARIANTS[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} title={title}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Field                                                               */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full border border-border bg-bg px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-steel";

/* ------------------------------------------------------------------ */
/* Notices                                                             */
/* ------------------------------------------------------------------ */

export function Notice({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <div className={`border-l-2 pl-4 text-sm ${TONE_TEXT[tone]} ${TONE_BORDER[tone].replace("border-", "border-l-")}`}>
      {children}
    </div>
  );
}

/** A COTEK footer mark. The ∞ lives here and nowhere else in this app. */
export function CotekEyebrow({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted ${className}`}>
      <span aria-hidden className="font-mono">
        ∞
      </span>
      A COTEK Product
    </span>
  );
}
