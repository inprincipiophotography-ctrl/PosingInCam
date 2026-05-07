#!/usr/bin/env bash
#
# scripts/cardify.sh — turn any JPEG into a Sony-camera-readable card.
#
# Pipeline (each step is its own simple exiftool call — robust across
# exiftool 12.x and 13.x and weird shell environments):
#
#   1. Re-encode input as BASELINE JPEG via sips. Cameras can't decode
#      progressive JPEG (which Canva and many tools emit by default),
#      so they fall back to the embedded thumbnail. This step
#      guarantees baseline output.
#   2. Copy ALL EXIF tags from the template onto the output.
#   3. Delete tags we want to *replace*: IFD1 (template's thumbnail),
#      ExifImageWidth/Height (template's image size), PreviewImage.
#   4. Write actual image dimensions into ExifImageWidth/Height.
#   5. Generate a fresh ~160px thumbnail from the actual output image
#      and embed it as the new IFD1 thumbnail.
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

# 1. Re-encode input as clean baseline JPEG.
echo "  1/5 re-encoding to baseline JPEG..."
sips -s format jpeg -s formatOptions 90 "$INPUT" --out "$OUTPUT" >/dev/null

# Verify sips actually produced the output file.
if [ ! -f "$OUTPUT" ]; then
  echo "error: sips did not create $OUTPUT" >&2
  exit 1
fi

# 2. Copy ALL EXIF from template onto output (this picks up Sony Make/Model,
#    MakerNotes, R98 InteropIFD, FlashpixVersion, etc.).
echo "  2/5 copying Sony EXIF metadata from template..."
exiftool -overwrite_original -tagsFromFile "$TEMPLATE" -all:all "$OUTPUT" >/dev/null

# 3. Delete tags that came along with -all:all but shouldn't (they describe
#    the template, not our card): the template's thumbnail IFD and its
#    image-size fields and any preview image blob.
echo "  3/5 stripping template-specific tags..."
exiftool -overwrite_original \
  "-IFD1:all=" \
  "-ExifImageWidth=" \
  "-ExifImageHeight=" \
  "-PreviewImage=" \
  "$OUTPUT" >/dev/null

# 4. Write the actual image dimensions into EXIF.
WIDTH=$(exiftool -ImageWidth -s -s -s "$OUTPUT")
HEIGHT=$(exiftool -ImageHeight -s -s -s "$OUTPUT")
echo "  4/6 writing real dimensions ${WIDTH}x${HEIGHT} into EXIF..."
exiftool -overwrite_original \
  "-ExifImageWidth=$WIDTH" \
  "-ExifImageHeight=$HEIGHT" \
  "$OUTPUT" >/dev/null

# 5. Force-write the R98 DCF marker. Some exiftool/Sony MakerNotes
#    interactions silently drop the InteropIFD during tag transfer, so we
#    write it explicitly here. Without R98 the camera may reject playback.
echo "  5/6 ensuring DCF marker (R98)..."
exiftool -overwrite_original \
  "-InteropIndex=R98" \
  "-InteropVersion=0100" \
  "-Orientation=1" \
  "-YCbCrPositioning=1" \
  "$OUTPUT" >/dev/null

# 6. Generate fresh thumbnail from output, embed it.
echo "  6/6 generating + embedding thumbnail..."
THUMB=$(mktemp -t cardify-thumb.XXXXXX).jpg
trap 'rm -f "$THUMB"' EXIT
sips -Z 160 "$OUTPUT" --out "$THUMB" >/dev/null
exiftool -overwrite_original "-ThumbnailImage<=$THUMB" "$OUTPUT" >/dev/null

# Summary.
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
