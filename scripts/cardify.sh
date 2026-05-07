#!/usr/bin/env bash
#
# scripts/cardify.sh — turn any JPEG into a Sony-camera-readable card.
#
# Pipeline:
#   1. Re-encode input as BASELINE JPEG (cameras can't decode progressive,
#      and Canva often exports progressive). This guarantees byte-clean
#      JPEG markers regardless of source.
#   2. Copy ALL Sony EXIF metadata from the template, except IFD1 thumbnail
#      data and ExifImageWidth/Height (which must match real dimensions).
#   3. Write the actual image dimensions back into ExifImageWidth/Height.
#   4. Build a fresh 160px-long-side thumbnail from the actual output and
#      embed it. (Otherwise the camera shows the template's thumbnail in
#      grid view, or rejects the file.)
#
# Requires:
#   - exiftool   (brew install exiftool)
#   - sips       (built into macOS)
#
# Usage:
#   scripts/cardify.sh <template.JPG> <input.jpg> <output.JPG>

set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <template.JPG> <input.jpg> <output.JPG>" >&2
  exit 1
fi

TEMPLATE="$1"
INPUT="$2"
OUTPUT="$3"

for f in "$TEMPLATE" "$INPUT"; do
  if [ ! -f "$f" ]; then
    echo "error: file not found: $f" >&2
    exit 1
  fi
done

for tool in exiftool sips; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "error: $tool not installed. Run: brew install exiftool" >&2
    exit 1
  fi
done

# 1. Re-encode input as a clean baseline JPEG. This strips Canva's
#    progressive encoding (cameras can't decode it) and any junk EXIF.
#    sips writes baseline JPEG by default with normal compression.
echo "  re-encoding to baseline JPEG..."
sips -s format jpeg -s formatOptions 90 "$INPUT" --out "$OUTPUT" >/dev/null

# 2. Copy template's EXIF tags except IFD1 (template's thumbnail) and
#    ExifImageWidth/Height (we set those to match actual image below).
echo "  copying Sony EXIF metadata..."
exiftool \
  -tagsFromFile "$TEMPLATE" \
  -all:all \
  --IFD1:all \
  --ExifImageWidth \
  --ExifImageHeight \
  --PreviewImage \
  --PreviewImageStart \
  --PreviewImageLength \
  "$OUTPUT" -overwrite_original >/dev/null

# 3. Write actual image dimensions into EXIF.
WIDTH=$(exiftool -ImageWidth -s -s -s "$OUTPUT")
HEIGHT=$(exiftool -ImageHeight -s -s -s "$OUTPUT")
exiftool \
  -ExifImageWidth="$WIDTH" \
  -ExifImageHeight="$HEIGHT" \
  "$OUTPUT" -overwrite_original >/dev/null

# 4. Build and embed a fresh thumbnail from the actual output image.
echo "  generating thumbnail..."
THUMB=$(mktemp -t cardify-thumb.XXXXXX).jpg
trap 'rm -f "$THUMB"' EXIT
sips -Z 160 "$OUTPUT" --out "$THUMB" >/dev/null
exiftool "-ThumbnailImage<=$THUMB" "$OUTPUT" -overwrite_original >/dev/null

# 5. Verification + summary.
SIZE_KB=$(($(stat -f %z "$OUTPUT") / 1024))
ENCODING=$(exiftool -EncodingProcess -s -s -s "$OUTPUT")
MAKE=$(exiftool -Make -s -s -s "$OUTPUT")
MODEL=$(exiftool -Model -s -s -s "$OUTPUT")
R98=$(exiftool -InteropIndex -s -s -s "$OUTPUT" 2>/dev/null || echo "(missing)")

echo ""
echo "✓ ${OUTPUT}"
echo "  ${WIDTH}×${HEIGHT}, ${SIZE_KB} KB"
echo "  Encoding:      ${ENCODING}"
echo "  Make/Model:    ${MAKE} / ${MODEL}"
echo "  DCF marker:    ${R98}"
echo ""
echo "Drop into DCIM/100MSDCF/ on your SD card and play back on the camera."
