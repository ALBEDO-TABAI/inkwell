#!/bin/bash
# Unsigned macOS arm64 test build from Linux: electron-builder (zip) → ad-hoc sign (rcodesign) → zip with symlinks → 25MB parts + md5.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=${OUT:-/workspace/dist-parts}; NAME=${NAME:-inkwell-mac-arm64-v1}
RCODESIGN=${RCODESIGN:-/home/box/tools/rcodesign}
npm run tokens >/dev/null && npm -w @inkwell/app run build >/dev/null
cd packages/desktop && rm -rf release && npm run dist:mac
"$RCODESIGN" sign release/mac-arm64/Inkwell.app >/dev/null   # ad-hoc: Apple Silicon refuses to run unsigned Mach-O
mkdir -p "$OUT" && rm -f "$OUT/$NAME".zip*
(cd release/mac-arm64 && python3 ../../../../scripts/zip-app.py . Inkwell.app "$OUT/$NAME.zip")
cd "$OUT" && split -b 25M -d -a 2 "$NAME.zip" "$NAME.zip.part" && md5sum "$NAME.zip" "$NAME.zip.part"* > MD5SUMS.txt && cat MD5SUMS.txt
