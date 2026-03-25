#!/bin/bash
# Build a distributable .zip for Bildeleringen Stats
# Usage: ./scripts/package.sh

set -e

VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')
OUTDIR="dist"
ZIPNAME="bildeleringen-stats-v${VERSION}.zip"

echo "Packaging Bildeleringen Stats v${VERSION}..."

rm -rf "$OUTDIR"
mkdir -p "$OUTDIR"

# Files to include in the release
zip -r "$OUTDIR/$ZIPNAME" \
  manifest.json \
  background.js \
  content.js \
  popup/ \
  dashboard/ \
  summary/ \
  lib/ \
  vendor/ \
  icons/ \
  LICENSE \
  README.md \
  -x "*.DS_Store" \
  -x "*debug*"

echo ""
echo "Created: $OUTDIR/$ZIPNAME"
echo "Size: $(du -h "$OUTDIR/$ZIPNAME" | cut -f1)"
echo ""
echo "Install instructions:"
echo "  Firefox: about:debugging → Load Temporary Add-on → select zip or manifest.json"
echo "  Chrome:  Unzip → chrome://extensions → Developer mode → Load unpacked"
