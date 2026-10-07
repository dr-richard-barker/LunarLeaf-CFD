#!/usr/bin/env bash
#
# Copy the canonical leaf-geometry module into a sibling tool.
#
# src/leaf/ lives here because this is the repo with the validated solver and the
# manuscript pipeline — the geometry has to stay in step with the physics that
# consumes it. AeroLeaf CFD renders the same leaves, so it gets a synced copy rather
# than its own divergent implementation. Same pattern as the sites.js sync: a copy
# with a banner, no submodule, no package registry.
#
#   tools/sync-leaf-module.sh ../../aeroleaf-cfd
#
# Edit src/leaf/ here, never the copy; re-run this to propagate.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-}"

if [[ -z "$DEST" ]]; then
  echo "usage: tools/sync-leaf-module.sh <path-to-target-repo>" >&2
  exit 2
fi
if [[ ! -d "$DEST" ]]; then
  echo "error: target '$DEST' is not a directory" >&2
  exit 1
fi

SRC="$HERE/src/leaf"
OUT="$DEST/leaf"
mkdir -p "$OUT/assets"

banner() {
  cat <<'EOF'
// ---------------------------------------------------------------------------
// GENERATED COPY — DO NOT EDIT HERE.
// Canonical source: LunarLeaf-CFD/src/leaf/
// Propagate changes with LunarLeaf-CFD/tools/sync-leaf-module.sh
// ---------------------------------------------------------------------------

EOF
}

count=0
for f in "$SRC"/*.ts; do
  name="$(basename "$f")"
  { banner; cat "$f"; } > "$OUT/$name"
  count=$((count + 1))
done

# Assets are data, not code — copied verbatim so a JSON diff stays a JSON diff.
rm -f "$OUT/assets"/*.json
cp "$SRC/assets"/*.json "$OUT/assets/"
assets=$(ls -1 "$SRC/assets"/*.json | wc -l | tr -d ' ')

echo "synced $count module file(s) and $assets asset(s) → $OUT"
