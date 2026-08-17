#!/usr/bin/env bash
#
# Acceptance criterion 8, made runnable.
#
# The criterion as written is:
#
#     grep -riE "screenshot|imageData|url|pageText" prisma/schema.prisma
#     → returns nothing
#
# Run verbatim it fails on one line, and it is not a privacy problem:
#
#     url      = env("DATABASE_URL")
#
# Prisma requires that key in the datasource block; there is no schema without
# it. So this script strips the `generator` and `datasource` blocks — neither of
# which can hold a column — and applies the criterion to the model definitions,
# which is what it was written to protect. It then extends the check to the
# protocol package, because a content field would reach the database through the
# wire schemas just as easily as through Prisma.
#
# Exit 0 means clean. Any hit is a bug, not a finding to discuss.
#
# See docs/PRIVACY-INVARIANTS.md.

set -uo pipefail

cd "$(dirname "$0")/.."

PATTERN='screenshot|imagedata|image_data|pagetext|page_text|\burl\b|\buri\b|hostname|\bdomain\b|searchterm|search_term|\bapp_?name\b|thumbnail|ocr|\bcaption\b|filepath|file_path|\bblob\b'
STATUS=0

echo "→ apps/web/prisma/schema.prisma (models only)"
MODELS=$(awk '
  /^[[:space:]]*(generator|datasource)[[:space:]]/ { skip = 1 }
  skip && /^[[:space:]]*}/ { skip = 0; next }
  !skip { print }
' apps/web/prisma/schema.prisma)

if HITS=$(printf '%s\n' "$MODELS" | grep -inE "$PATTERN"); then
  echo "$HITS" | sed 's/^/    /'
  STATUS=1
else
  echo "    clean"
fi

echo "→ packages/protocol/src (the wire schemas)"
# Comment lines are excluded: the invariants are *stated* in comments, and a
# sentence promising there is no URL here must not read as a URL being here.
if HITS=$(grep -rinE "$PATTERN" packages/protocol/src --include='*.ts' \
    | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(\*|//|/\*)'); then
  echo "$HITS" | sed 's/^/    /'
  STATUS=1
else
  echo "    clean"
fi

if [ "$STATUS" -eq 0 ]; then
  echo
  echo "Privacy check clean. Nothing in the schema or on the wire can carry content."
else
  echo
  echo "PRIVACY CHECK FAILED — see docs/PRIVACY-INVARIANTS.md before changing anything."
fi

exit "$STATUS"
