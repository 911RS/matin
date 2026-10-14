#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/supabase/functions/_vendor"

rm -rf "$dest"
mkdir -p "$dest/backend" "$dest/engine"
cp -r "$root/packages/backend/src" "$dest/backend/src"
cp -r "$root/packages/engine/src" "$dest/engine/src"
