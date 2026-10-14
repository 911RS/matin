#!/usr/bin/env bash
# Copies the MediaPipe script and wasm runtime and downloads the models served from public/mediapipe/<version>/.
# Idempotent: files that already exist with the expected size are skipped. Other versions are removed.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pkg="$(cd "$root" && node -p "require('path').dirname(require.resolve('@mediapipe/tasks-vision'))")"
version="$(node -p "require(process.argv[1]).version" "$pkg/package.json")"
public="$root/public/mediapipe"
out="$public/$version"

for entry in "$public"/*; do
  case "$(basename "$entry")" in
    LICENSE | README.md | "$version") ;;
    *) rm -rf "$entry" ;;
  esac
done

mkdir -p "$out/wasm"

size() { stat -c %s "$1" 2>/dev/null || stat -f %z "$1"; }

copy() {
  if [ -f "$2" ] && [ "$(size "$2")" = "$(size "$1")" ]; then return; fi
  cp "$1" "$2"
}

copy "$pkg/vision_bundle.js" "$out/vision_bundle.js"
for name in vision_wasm_internal vision_wasm_nosimd_internal; do
  copy "$pkg/wasm/$name.js" "$out/wasm/$name.js"
  copy "$pkg/wasm/$name.wasm" "$out/wasm/$name.wasm"
done

fetch() {
  local url="$1" name="$2" expected="$3"
  if [ -f "$out/$name" ] && [ "$(size "$out/$name")" = "$expected" ]; then return; fi
  curl --fail --location --silent --show-error --output "$out/$name.part" "$url"
  if [ "$(size "$out/$name.part")" != "$expected" ]; then
    rm -f "$out/$name.part"
    echo "Unexpected size for $name" >&2
    exit 1
  fi
  mv "$out/$name.part" "$out/$name"
}

fetch https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite magic_touch.tflite 6227884
fetch https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite efficientnet_lite0.tflite 18582189
