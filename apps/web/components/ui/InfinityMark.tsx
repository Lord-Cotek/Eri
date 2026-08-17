// The ∞ — COTEK's quiet signature.
//
// In Ẹ̀rí it appears in exactly one place: the "A COTEK Product" eyebrow slot,
// set separately and smaller. It is never locked up with the Ẹ̀rí mark.
export function InfinityMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 16c0-6 5-10 10-5l12 10c5 5 10 1 10-5s-5-10-10-5L26 26c-5 5-10 1-10-5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
