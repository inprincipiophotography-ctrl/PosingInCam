#!/usr/bin/env bash
#
# scripts/cardify.sh — turn any JPEG into a Sony-camera-readable card.
#
# Replicates real-Sony JPEG storage convention:
#   - file pixel dimensions are ALWAYS 1920x1280 (landscape)
#   - portrait cards: content rotated 90° CCW into the landscape canvas,
#                     then EXIF Orientation=6 tells the camera to rotate
#                     the display 90° CW. Sony's auto-rotate then keeps
#                     the card upright regardless of how the user holds
#                     the camera in playback.
#   - landscape cards: content fills the canvas naturally, EXIF
#                      Orientation=1.
#
# Why this matters: the previous version stored portrait cards as 1280x1920
# pixel files with Orientation=1. Sony's playback then couldn't auto-rotate
# correctly when the user turned the camera vertically — the image came out
# upside-down or sideways. Real Sony portrait JPEGs are always landscape on
# disk with the rotation handled by the Orientation tag, and that's what
# we now do too.
#
# Other strict spec details (matching Cue):
#   - encoding:       baseline DCT, Huffman coding (NOT progressive)
#   - subsampling:    YCbCr 4:2:2 (sips defaults to 4:2:0; some Sony
#                                  firmwares reject that)
#   - quality:        90
#   - color profile:  none (strip ICC; Sony writes none)
#   - EXIF:           full Sony tag set from a real-camera template +
#                     forced R98 DCF marker
#   - thumbnail:      fresh ~160px JPEG of the actual card
#
# Encoders tried in priority order:
#   1. ImageMagick (recommended; brew install imagemagick)
#   2. Python 3 + Pillow
#   3. sips
#
# Usage:
#   scripts/cardify.sh [-l|-p|-a] <template.JPG> <input.jpg> <output.JPG>
#
#   -l, --landscape   force landscape output (Orientation=1)
#   -p, --portrait    force portrait output (Orientation=6, rotates correctly
#                     when camera is held vertically)
#   -a, --auto        auto-detect from input aspect ratio (default)

set -euo pipefail

ORIENTATION=auto

while [ "$#" -gt 0 ]; do
  case "$1" in
    -l|--landscape) ORIENTATION=landscape; shift ;;
    -p|--portrait)  ORIENTATION=portrait;  shift ;;
    -a|--auto)      ORIENTATION=auto;      shift ;;
    --) shift; break ;;
    -*) echo "error: unknown option: $1" >&2; exit 1 ;;
    *)  break ;;
  esac
done

if [ "$#" -ne 3 ]; then
  echo "usage: $0 [-l|-p|-a] <template.JPG> <input.jpg> <output.JPG>" >&2
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

ENCODER=""
if command -v magick >/dev/null 2>&1; then
  ENCODER="imagemagick"; IM_BIN="magick"
elif command -v convert >/dev/null 2>&1; then
  ENCODER="imagemagick"; IM_BIN="convert"
elif python3 -c "from PIL import Image" >/dev/null 2>&1; then
  ENCODER="pillow"
elif command -v sips >/dev/null 2>&1; then
  ENCODER="sips"
else
  echo "error: no JPEG encoder available. Run: brew install imagemagick" >&2
  exit 1
fi
echo "  encoder: $ENCODER"

# Resolve "auto" by sniffing input aspect.
if [ "$ORIENTATION" = "auto" ]; then
  if command -v sips >/dev/null 2>&1; then
    INPUT_W=$(sips -g pixelWidth "$INPUT" | tail -1 | awk '{print $2}')
    INPUT_H=$(sips -g pixelHeight "$INPUT" | tail -1 | awk '{print $2}')
  else
    INPUT_W=$(exiftool -ImageWidth -s -s -s "$INPUT")
    INPUT_H=$(exiftool -ImageHeight -s -s -s "$INPUT")
  fi
  if [ "$INPUT_W" -ge "$INPUT_H" ]; then
    ORIENTATION=landscape
  else
    ORIENTATION=portrait
  fi
fi

# Choose dimensions, rotation, and EXIF orientation per output orientation.
# File pixel dimensions are ALWAYS 1920x1280 (landscape on disk).
OUT_W=1920
OUT_H=1280

if [ "$ORIENTATION" = "portrait" ]; then
  PRE_W=1280   # logical portrait dimensions before rotation
  PRE_H=1920
  ROTATE=ccw90 # rotate 90° counter-clockwise after resize
  EXIF_ORIENT=6
else
  PRE_W=1920
  PRE_H=1280
  ROTATE=none
  EXIF_ORIENT=1
fi
echo "  orientation: $ORIENTATION (file ${OUT_W}x${OUT_H}, EXIF Orientation=$EXIF_ORIENT)"

# 1. Re-encode with strict settings, optionally rotating into landscape.
echo "  1/6 re-encoding (baseline, 4:2:2, q90)..."
case "$ENCODER" in
  imagemagick)
    if [ "$ROTATE" = "ccw90" ]; then
      "$IM_BIN" "$INPUT" \
        -resize "${PRE_W}x${PRE_H}!" \
        -rotate -90 \
        -interlace none -sampling-factor 4:2:2 -quality 90 -strip \
        "$OUTPUT"
    else
      "$IM_BIN" "$INPUT" \
        -resize "${PRE_W}x${PRE_H}!" \
        -interlace none -sampling-factor 4:2:2 -quality 90 -strip \
        "$OUTPUT"
    fi
    ;;
  pillow)
    python3 - "$INPUT" "$OUTPUT" "$PRE_W" "$PRE_H" "$ROTATE" <<'PYEOF'
import sys
from PIL import Image
inp, out, pw, ph, rot = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
img = Image.open(inp).convert("RGB").resize((pw, ph), Image.LANCZOS)
if rot == "ccw90":
    img = img.transpose(Image.ROTATE_90)  # PIL ROTATE_90 = counter-clockwise 90°
img.save(out, "JPEG", quality=90, optimize=True, progressive=False, subsampling=1)
PYEOF
    ;;
  sips)
    sips -s format jpeg -s formatOptions 90 -z "$PRE_H" "$PRE_W" "$INPUT" --out "$OUTPUT" >/dev/null
    if [ "$ROTATE" = "ccw90" ]; then
      sips -r -90 "$OUTPUT" >/dev/null
    fi
    ;;
esac

if [ ! -f "$OUTPUT" ]; then
  echo "error: encoder did not create $OUTPUT" >&2
  exit 1
fi

echo "  2/6 copying Sony EXIF from template..."
exiftool -overwrite_original -tagsFromFile "$TEMPLATE" -all:all "$OUTPUT" >/dev/null 2>&1 || true

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

echo "  4/6 writing dimensions ${OUT_W}x${OUT_H} into EXIF..."
exiftool -overwrite_original \
  "-ExifImageWidth=$OUT_W" \
  "-ExifImageHeight=$OUT_H" \
  "$OUTPUT" >/dev/null 2>&1 || true

echo "  5/6 forcing DCF marker (R98) + Orientation=$EXIF_ORIENT..."
exiftool -overwrite_original -n \
  "-InteropIndex=R98" \
  "-InteropVersion=0100" \
  "-Orientation=$EXIF_ORIENT" \
  "-YCbCrPositioning=1" \
  "$OUTPUT" >/dev/null 2>&1 || true

echo "  6/6 generating + embedding thumbnail..."
THUMB=$(mktemp -t cardify-thumb.XXXXXX).jpg
trap 'rm -f "$THUMB"' EXIT
case "$ENCODER" in
  imagemagick)
    "$IM_BIN" "$OUTPUT" -resize 160x120 -quality 80 -strip "$THUMB"
    ;;
  pillow)
    python3 - "$OUTPUT" "$THUMB" <<'PYEOF'
import sys
from PIL import Image
img = Image.open(sys.argv[1]).convert("RGB")
img.thumbnail((160, 160), Image.LANCZOS)
img.save(sys.argv[2], "JPEG", quality=80, progressive=False, subsampling=1)
PYEOF
    ;;
  sips)
    sips -Z 160 "$OUTPUT" --out "$THUMB" >/dev/null
    ;;
esac
exiftool -overwrite_original "-ThumbnailImage<=$THUMB" "$OUTPUT" >/dev/null 2>&1 || true

set +u
SIZE_KB=$(($(wc -c < "$OUTPUT" | tr -d ' ') / 1024))
ENCODING=$(exiftool -EncodingProcess -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
SUBSAMPLING=$(exiftool -YCbCrSubSampling -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
MAKE=$(exiftool -Make -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
MODEL=$(exiftool -Model -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
ORIENT=$(exiftool -Orientation -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
R98=$(exiftool -InteropIndex -s -s -s "$OUTPUT" 2>/dev/null || echo "(missing)")

echo ""
echo "✓ ${OUTPUT}"
echo "  ${OUT_W}×${OUT_H}, ${SIZE_KB} KB"
echo "  Encoding:      ${ENCODING}"
echo "  Subsampling:   ${SUBSAMPLING}"
echo "  Make/Model:    ${MAKE} / ${MODEL}"
echo "  Orientation:   ${ORIENT}"
echo "  DCF marker:    ${R98}"
