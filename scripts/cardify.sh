#!/usr/bin/env bash
#
# scripts/cardify.sh — turn any JPEG into a Sony-camera-readable card.
#
# Strict JPEG spec, matching what Cue ships (and what real Sony shots are):
#   - dimensions:     exactly 1920x1280 (landscape) or 1280x1920 (portrait)
#                     both multiples of 16, the JPEG MCU block size
#   - encoding:       baseline DCT, Huffman coding (NOT progressive)
#   - subsampling:    YCbCr 4:2:2  (matches Cue; sips defaults to 4:2:0
#                                   which some Sony firmwares reject)
#   - quality:        90
#   - color profile:  none (strip ICC; Sony writes none)
#   - EXIF:           full Sony tag set from a real-camera template +
#                     forced R98 DCF marker + correct dimensions
#   - thumbnail:      fresh 160-px-long-side JPEG of the actual card
#
# Tries encoders in this order (first available wins):
#   1. ImageMagick (`magick` or `convert`)  — best control, recommended
#   2. Python 3 + Pillow                    — second best
#   3. sips                                 — fallback, lacks subsampling
#                                             control; may not work on
#                                             every Sony body
#
# Recommended: brew install imagemagick (one-time setup)
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

if ! command -v exiftool >/dev/null 2>&1; then
  echo "error: exiftool not installed. Run: brew install exiftool" >&2
  exit 1
fi

# Pick the best available encoder.
ENCODER=""
if command -v magick >/dev/null 2>&1; then
  ENCODER="imagemagick"
  IM_BIN="magick"
elif command -v convert >/dev/null 2>&1; then
  ENCODER="imagemagick"
  IM_BIN="convert"
elif python3 -c "from PIL import Image" >/dev/null 2>&1; then
  ENCODER="pillow"
elif command -v sips >/dev/null 2>&1; then
  ENCODER="sips"
else
  echo "error: no JPEG encoder available. Install one of:" >&2
  echo "   brew install imagemagick   (recommended)" >&2
  echo "   python3 -m pip install Pillow" >&2
  exit 1
fi
echo "  encoder: $ENCODER"

# Detect input orientation, target Cue-compatible dimensions.
if command -v sips >/dev/null 2>&1; then
  INPUT_W=$(sips -g pixelWidth "$INPUT" | tail -1 | awk '{print $2}')
  INPUT_H=$(sips -g pixelHeight "$INPUT" | tail -1 | awk '{print $2}')
else
  INPUT_W=$(exiftool -ImageWidth -s -s -s "$INPUT")
  INPUT_H=$(exiftool -ImageHeight -s -s -s "$INPUT")
fi

if [ "$INPUT_W" -ge "$INPUT_H" ]; then
  OUT_W=1920
  OUT_H=1280
else
  OUT_W=1280
  OUT_H=1920
fi
echo "  source: ${INPUT_W}x${INPUT_H} -> target: ${OUT_W}x${OUT_H}"

# 1. Re-encode with strict settings.
echo "  1/6 re-encoding (baseline, 4:2:2, quality 90)..."
case "$ENCODER" in
  imagemagick)
    "$IM_BIN" "$INPUT" \
      -resize "${OUT_W}x${OUT_H}!" \
      -interlace none \
      -sampling-factor 4:2:2 \
      -quality 90 \
      -strip \
      "$OUTPUT"
    ;;
  pillow)
    python3 - <<PYEOF
from PIL import Image
img = Image.open("$INPUT").convert("RGB").resize(($OUT_W, $OUT_H), Image.LANCZOS)
img.save("$OUTPUT", "JPEG", quality=90, optimize=True, progressive=False, subsampling=1)
PYEOF
    ;;
  sips)
    sips -s format jpeg -s formatOptions 90 -z "$OUT_H" "$OUT_W" "$INPUT" --out "$OUTPUT" >/dev/null
    ;;
esac

if [ ! -f "$OUTPUT" ]; then
  echo "error: encoder did not create $OUTPUT" >&2
  exit 1
fi

# 2. Copy ALL EXIF from template.
echo "  2/6 copying Sony EXIF from template..."
exiftool -overwrite_original -tagsFromFile "$TEMPLATE" -all:all "$OUTPUT" >/dev/null 2>&1 || true

# 3. Strip template-specific tags + ICC + XMP + IPTC.
echo "  3/6 stripping template-specific + extra metadata..."
exiftool -overwrite_original \
  "-IFD1:all=" \
  "-ExifImageWidth=" \
  "-ExifImageHeight=" \
  "-PreviewImage=" \
  "-ICC_Profile:all=" \
  "-XMP:all=" \
  "-IPTC:all=" \
  "$OUTPUT" >/dev/null 2>&1 || true

# 4. Write the (now-known) target dimensions back into EXIF.
echo "  4/6 writing dimensions ${OUT_W}x${OUT_H} into EXIF..."
exiftool -overwrite_original \
  "-ExifImageWidth=$OUT_W" \
  "-ExifImageHeight=$OUT_H" \
  "$OUTPUT" >/dev/null 2>&1 || true

# 5. Force the DCF compliance markers.
echo "  5/6 forcing DCF marker (R98) + orientation + YCbCr positioning..."
exiftool -overwrite_original \
  "-InteropIndex=R98" \
  "-InteropVersion=0100" \
  "-Orientation=1" \
  "-YCbCrPositioning=1" \
  "$OUTPUT" >/dev/null 2>&1 || true

# 6. Generate fresh thumbnail and embed it.
echo "  6/6 generating + embedding thumbnail..."
THUMB=$(mktemp -t cardify-thumb.XXXXXX).jpg
trap 'rm -f "$THUMB"' EXIT

case "$ENCODER" in
  imagemagick)
    "$IM_BIN" "$OUTPUT" -resize 160x120 -quality 80 -strip "$THUMB"
    ;;
  pillow)
    python3 - <<PYEOF
from PIL import Image
img = Image.open("$OUTPUT").convert("RGB")
img.thumbnail((160, 160), Image.LANCZOS)
img.save("$THUMB", "JPEG", quality=80, progressive=False, subsampling=1)
PYEOF
    ;;
  sips)
    sips -Z 160 "$OUTPUT" --out "$THUMB" >/dev/null
    ;;
esac

exiftool -overwrite_original "-ThumbnailImage<=$THUMB" "$OUTPUT" >/dev/null 2>&1 || true

# Summary. Don't let `set -u` or stat-flavor differences kill the run.
set +u
SIZE_BYTES=$(wc -c < "$OUTPUT" | tr -d ' ')
SIZE_KB=$((SIZE_BYTES / 1024))
ENCODING=$(exiftool -EncodingProcess -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
SUBSAMPLING=$(exiftool -YCbCrSubSampling -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
MAKE=$(exiftool -Make -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
MODEL=$(exiftool -Model -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
R98=$(exiftool -InteropIndex -s -s -s "$OUTPUT" 2>/dev/null || echo "(missing)")
THUMB_BYTES=$(exiftool -ThumbnailImage -b "$OUTPUT" 2>/dev/null | wc -c | tr -d ' ')

echo ""
echo "✓ ${OUTPUT}"
echo "  ${OUT_W}×${OUT_H}, ${SIZE_KB} KB"
echo "  Encoding:      ${ENCODING}"
echo "  Subsampling:   ${SUBSAMPLING}"
echo "  Make/Model:    ${MAKE} / ${MODEL}"
echo "  DCF marker:    ${R98}"
echo "  Thumbnail:     ${THUMB_BYTES} bytes embedded"
echo ""
echo "Drop into DCIM/100MSDCF/ on your SD card and play back on the camera."
