# Served brand assets

These are the delivered brand assets, in the one place Next.js can serve them
from. This directory is now the source of truth — the delivered kit used to sit
at `/public/` in the repo root and has been removed, since carrying two copies
of every icon invites them to diverge.

The rules that govern these assets are in [`docs/BRAND.md`](../../../../docs/BRAND.md).

| Here | Was |
|---|---|
| `icons/` | `eri-brand/icons/` |
| `social/` | `eri-brand/social/` |
| `svg/` | `eri-brand/svg/` |
| `../favicon.ico` | `eri-brand/web/favicon.ico` |
| `../site.webmanifest` | `eri-brand/web/site.webmanifest` |

The rest of the kit was wired in rather than copied, and the originals are in
git history if they are ever needed again:

- `eri-brand/web/tokens.css` → merged into `app/globals.css`
- `eri-brand/web/HEAD-SNIPPET.html` → expressed as `metadata` in `app/layout.tsx`
- `eri-brand/react/EriMark.tsx` → `components/ui/EriMark.tsx`
- `eri-brand/BRAND.md` → `docs/BRAND.md`

**Do not add `app/icon.tsx`, `app/apple-icon.tsx` or `app/opengraph-image.tsx`.**
The App Router gives those generators precedence over static files, so these
assets would silently never appear. The COTEK scaffold ships them by default;
they were deliberately left out of this app.

Placeholder logos are never generated for Ẹ̀rí. If an asset is missing, it is
missing until the brand work supplies it.
