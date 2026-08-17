# Served brand assets

These are a copy of the delivered brand kit, placed where Next.js can serve
them. The kit as delivered is at `/public/eri-brand-v1/eri-brand/` in the repo
root, and that remains the source of truth — regenerate these from there rather
than editing them in place.

| Here | From |
|---|---|
| `icons/` | `eri-brand/icons/` |
| `social/` | `eri-brand/social/` |
| `svg/` | `eri-brand/svg/` |
| `../favicon.ico` | `eri-brand/web/favicon.ico` |
| `../site.webmanifest` | `eri-brand/web/site.webmanifest` |

The rest of the kit is wired in rather than copied:

- `eri-brand/web/tokens.css` → merged into `app/globals.css`
- `eri-brand/web/HEAD-SNIPPET.html` → expressed as `metadata` in `app/layout.tsx`
- `eri-brand/react/EriMark.tsx` → `components/ui/EriMark.tsx`

**Do not add `app/icon.tsx`, `app/apple-icon.tsx` or `app/opengraph-image.tsx`.**
The App Router gives those generators precedence over static files, so these
assets would silently never appear. The COTEK scaffold ships them by default;
they were deliberately left out of this app.

Placeholder logos are never generated for Ẹ̀rí. If an asset is missing, it is
missing until the brand work supplies it.
