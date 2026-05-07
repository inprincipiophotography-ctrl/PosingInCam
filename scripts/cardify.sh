#!/usr/bin/env bash
#
# scripts/cardify.sh — turn a Canva (or any) JPEG into a Sony-camera-readable
# card by copying EXIF metadata from a template Sony shot, while keeping the
# real image dimensions and generating a fresh thumbnail from the actual card.
#
# Why this matters:
#   The naive `exiftool -tagsFromFile X.JPG -all:all Y.JPG` copies EVERYTHING,
#   including the embedded 160x120 thumbnail and the ExifImageWidth/Height
#   tags. If your card has different dimensions or different visual content
#   from the template, the camera shows the *template's* thumbnail in grid
#   view (or rejects the file entirely because dimensions don't match).
#
# Requires:
#   - exiftool   (brew install exiftool)
#   - sips       (built into macOS)
#
# Usage:
#   scripts/cardify.sh <template.JPG> <input.jpg> <output.JPG>
#
# Example:
#   scripts/cardify.sh ~/Desktop/sony-template.JPG \
#                      ~/Desktop/canva-export.jpg \
#                      ~/Desktop/DSC00099.JPG
#
#   <template.JPG>  a real Sony shot you took (or a Cue sample) — we copy EXIF
#                   metadata from this. Make/Model, R98 DCF marker, Sony
#                   MakerNotes, all the camera-friendly tags.
#   <input.jpg>     your Canva (or anywhere) design exported as JPEG.
#   <output.JPG>    the camera-ready file. Use DSCNNNNN.JPG naming for Sony.

set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <template.JPG> <input.jpg> <output.JPG>" >&2
  echo "" >&2
  echo "  template = a real Sony shot to copy EXIF from" >&2
  echo "  input    = your Canva-exported JPEG" >&2
  echo "  output   = camera-ready filename (DSC00099.JPG style)" >&2
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

# 1. Start from a fresh copy of the input (we don't mutate the user's source).
cp "$INPUT" "$OUTPUT"

# 2. Copy every EXIF tag from the template EXCEPT:
#      - IFD1:all       (the thumbnail-IFD that points to template's thumbnail)
#      - ExifImageWidth / ExifImageHeight  (must match the actual image)
#      - PreviewImage*  (Sony-specific big preview, will conflict)
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

# 3. Read the *actual* image dimensions and write them back to EXIF, so the
#    camera's "expected size" tags match the real pixel data.
WIDTH=$(exiftool -ImageWidth -s -s -s "$OUTPUT")
HEIGHT=$(exiftool -ImageHeight -s -s -s "$OUTPUT")
exiftool \
  -ExifImageWidth="$WIDTH" \
  -ExifImageHeight="$HEIGHT" \
  "$OUTPUT" -overwrite_original >/dev/null

# 4. Build a fresh thumbnail from the OUTPUT image (long edge max 160px) and
#    embed it. Cameras use this for grid view.
THUMB=$(mktemp -t cardify-thumb.XXXXXX).jpg
trap 'rm -f "$THUMB"' EXIT
sips -Z 160 "$OUTPUT" --out "$THUMB" >/dev/null
exiftool "-ThumbnailImage<=$THUMB" "$OUTPUT" -overwrite_original >/dev/null

# 5. Summary.
SIZE_KB=$(($(stat -f %z "$OUTPUT") / 1024))
MAKE=$(exiftool -Make -s -s -s "$OUTPUT")
MODEL=$(exiftool -Model -s -s -s "$OUTPUT")
R98=$(exiftool -InteropIndex -s -s -s "$OUTPUT" || echo "(missing)")

echo "✓ ${OUTPUT}"
echo "  ${WIDTH}×${HEIGHT}, ${SIZE_KB} KB"
echo "  Make/Model:    ${MAKE} / ${MODEL}"
echo "  DCF marker:    ${R98}"
echo "  Thumbnail:     embedded ($(sips -g pixelWidth -g pixelHeight "$THUMB" 2>/dev/null | grep -E 'pixel(Width|Height)' | awk '{print $2}' | tr '\n' 'x' | sed 's/x$//'))"
echo ""
echo "Drop into DCIM/100MSDCF/ on your SD card and play back on the camera."
