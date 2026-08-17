// Ẹ̀rí — brand mark. Stroke-drawn, inherits currentColor.
// The open ring is the grace window; the dot beneath is the Yoruba under-dot of ẹ.
// Never lock this up with COTEK's InfinityMark — the ∞ belongs only in the
// "A COTEK Product" eyebrow slot.
//
// Colour rules: steel, ink, white or black only. Never amber, sage or alert —
// those mean something specific in the product and the mark must not appear to
// be reporting a state.

type Props = {
  size?: number;
  className?: string;
  title?: string;
  /** Optical variant. "small" thickens the stroke; "micro" drops the under-dot (≤20px). */
  weight?: "regular" | "small" | "micro";
};

export function EriMark({ size = 24, className, title, weight = "regular" }: Props) {
  const sw = weight === "micro" ? 13 : weight === "small" ? 11 : 7;
  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path d="M78.4 26.6 A34 34 0 1 1 49.6 26.6" />
      {weight !== "micro" && (
        <circle
          cx="64"
          cy={weight === "small" ? 108 : 106}
          r={weight === "small" ? 10 : 7}
          fill="currentColor"
          stroke="none"
        />
      )}
    </svg>
  );
}

export default EriMark;
