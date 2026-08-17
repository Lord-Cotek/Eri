import type { Config } from "tailwindcss";

/**
 * COTEK "evangelical clarity", tuned sober for Ẹ̀rí.
 *
 * Colours live as CSS variables in app/globals.css. Note what is missing:
 * there is no `positive`, no `success`, no green-for-good. Ẹ̀rí does not
 * measure "clean". `sage` means one specific thing — he came forward himself —
 * and nothing else may borrow it.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",

        /** resting / neutral — the Ẹ̀rí accent */
        steel: "rgb(var(--steel-rgb) / <alpha-value>)",
        /** he disclosed himself */
        sage: "rgb(var(--sage-rgb) / <alpha-value>)",
        /** the window lapsed — a warning, never "good" */
        amber: "rgb(var(--amber-rgb) / <alpha-value>)",
        /** heartbeat lost */
        alert: "rgb(var(--alert-rgb) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: { DEFAULT: "2px" },
      maxWidth: { prose: "66ch" },
      transitionTimingFunction: { editorial: "cubic-bezier(0.2,0.6,0.2,1)" },
    },
  },
  plugins: [],
};

export default config;
