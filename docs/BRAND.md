# Ẹ̀rí — brand

**Ẹ̀rí** (Yoruba: *witness, testimony, record*). The AI companion is **Ẹlẹ́rìí** — *the one who
bears witness*.

A COTEK product.

---

## The mark

An open ring with a dot beneath it.

The ring is broken at the top, and **the gap is the grace window** — the space in which a man
may speak for himself before the record speaks for him. That gap is the whole product, so it is
the whole mark. The dot beneath is the Yoruba under-dot of *ẹ*, which carries the name's
orthography into the symbol.

It is drawn, never filled. A witness records; he does not weigh in.

### Rules

- Clear space on all sides ≥ the ring's stroke width × 4.
- Minimum size 16px. Below 20px use the **micro** variant (ring only, heavier stroke) — the
  under-dot closes up and reads as noise.
- Never rotate, never add a drop shadow, never place inside a filled circle.
- **Never lock the mark up with COTEK's `InfinityMark` (∞).** The ∞ belongs only in the
  "A COTEK Product" eyebrow slot, set separately and smaller.
- The mark may sit in `--steel`, `--ink`, white, or black. It never takes `--amber`, `--sage`,
  or `--alert` — those colours mean something specific in the product and the mark must not
  appear to be reporting a state.

---

## Colour

| Token | Hex | Meaning |
|---|---|---|
| `--bg` | `#0B0E14` | base |
| `--surface` | `#141926` | panels |
| `--border` | `#242B3B` | hairlines |
| `--ink` | `#E8EBF2` | primary text |
| `--muted` | `#8892A6` | secondary text |
| `--steel` | `#93AECB` | **resting / neutral** — the Ẹ̀rí accent |
| `--sage` | `#7FA88A` | **he disclosed himself** |
| `--amber` | `#F59E0B` | **the window lapsed** |
| `--alert` | `#C4574F` | **heartbeat lost** |

Colour carries moral state and nothing else. It is never decorative, and there is no colour
that means "clean" — the product does not measure that.

The suite amber appears here **only** as a warning. In Ẹ̀rí it never means "good".

---

## Type

- **Display:** Playfair Display, weight 500. Headings and the wordmark only.
- **Workhorse:** **IBM Plex Mono** — *not DM Mono*. DM Mono has no glyphs for `ẹ ọ Ẹ Ọ` and
  therefore cannot render this app's own name, or Ẹlẹ́rìí's. Stack:
  `'IBM Plex Mono', 'DM Mono', ui-monospace, monospace`.
- The wordmark ships **outlined** — no font dependency, correct Yoruba diacritics baked in.

## Voice

Plain testimony. Sober, factual, unhurried. Short sentences.

No exclamation marks. No congratulation, no streaks, no badges, no confetti. Nothing that
frames a man's obedience as a score. A rhythm that breaks is restorable, never a broken counter.

---

## Files

```
svg/      mark, wordmark, and both lockups — currentColor, steel/ink, white, black
icons/    16 → 1024 px, apple-touch-icon, maskable (Android safe zone), mono, transparent
social/   og-image 1200×630, square 1200, banner 1500×500
web/      favicon.ico, site.webmanifest, HEAD-SNIPPET.html, tokens.css
react/    EriMark.tsx
```

## How it is wired in

*Done — recorded here so the mapping is not lost. The kit was delivered as a
standalone folder; these steps have been carried out and the folder removed.*

1. Copy `icons/`, `social/`, `svg/` → `apps/web/public/brand/`.
2. Copy `web/favicon.ico` and `web/site.webmanifest` → `apps/web/public/`.
3. Paste `web/HEAD-SNIPPET.html` into the root layout `<head>`, or express it as `metadata`.
4. Merge `web/tokens.css` into `app/globals.css`.
5. Drop `react/EriMark.tsx` into `components/ui/`.

> **Delete `app/icon.tsx`, `app/apple-icon.tsx`, and `app/opengraph-image.tsx` if the COTEK
> scaffold generated them.** Next.js App Router gives those `.tsx` generators precedence over
> static files, so the new assets will silently never appear. This is the same trap that caught
> Bene.
