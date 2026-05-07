#!/usr/bin/env bash
#
# scripts/cardify.sh — turn any JPEG into a Sony-camera-readable card.
#
# Strict JPEG spec, matching what Cue ships:
#   - dimensions:     1920x1280 (landscape) or 1280x1920 (portrait)
#                     both multiples of 16, the JPEG MCU block size
#   - encoding:       baseline DCT, Huffman coding (NOT progressive)
#   - subsampling:    YCbCr 4:2:2  (sips defaults to 4:2:0; some Sony
#                                   firmwares reject that)
#   - quality:        90
#   - color profile:  none (strip ICC; Sony writes none)
#   - EXIF:           full Sony tag set from a real-camera template +
#                     forced R98 DCF marker + correct dimensions
#   - thumbnail:      fresh ~160px JPEG of the actual card
#
# Tries encoders in priority order:
#   1. ImageMagick (`magick` or `convert`)  — recommended (best control)
#   2. Python 3 + Pillow                    — second
#   3. sips                                 — fallback (no subsampling)
#
# Recommended: brew install imagemagick (one-time setup)
#
# Usage:
#   scripts/cardify.sh [-l|-p|-a] <template.JPG> <input.jpg> <output.JPG>
#
#   -l, --landscape   force output 1920x1280 (camera held horizontally)
#   -p, --portrait    force output 1280x1920 (camera held vertically)
#   -a, --auto        auto-detect from input aspect ratio (default)
#
# Sony A7 IV note on display:
#   The camera reads the EXIF Orientation tag to know how to rotate.
#   We force Orientation=1 ("no rotation"), so the file's pixel orientation
#   IS what the camera shows. A portrait file (1280x1920) appears small
#   centered on the LCD when the camera is held horizontally; rotate the
#   camera 90° and it fills the screen. A landscape file (1920x1280) fills
#   the LCD when held horizontally. Pick the one that matches how you
#   typically hold the camera between shots.

set -euo pipefail

ORIENTATION=auto

while [ "$#" -gt 0 ]; do
  case "$1" in
    -l|--landscape) ORIENTATION=landscape; shift ;;
    -p|--portrait)  ORIENTATION=portrait;  shift ;;
    -a|--auto)      ORIENTATION=auto;      shift ;;
    -h|--help)
      sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    --) shift; break ;;
    -*) echo "error: unknown option: $1" >&2; exit 1 ;;
    *)  break ;;
  esac
done

if [ "$#" -ne 3 ]; then
  echo "usage: $0 [-l|-p|-a] <template.JPG> <input.jpg> <output.JPG>" >&2
  echo "  -l, --landscape   force 1920x1280" >&2
  echo "  -p, --portrait    force 1280x1920" >&2
  echo "  -a, --auto        auto-detect (default)" >&2
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

# Decide target dimensions.
if [ "$ORIENTATION" = "landscape" ]; then
  OUT_W=1920; OUT_H=1280
elif [ "$ORIENTATION" = "portrait" ]; then
  OUT_W=1280; OUT_H=1920
else
  if command -v sips >/dev/null 2>&1; then
    INPUT_W=$(sips -g pixelWidth "$INPUT" | tail -1 | awk '{print $2}')
    INPUT_H=$(sips -g pixelHeight "$INPUT" | tail -1 | awk '{print $2}')
  else
    INPUT_W=$(exiftool -ImageWidth -s -s -s "$INPUT")
    INPUT_H=$(exiftool -ImageHeight -s -s -s "$INPUT")
  fi
  if [ "$INPUT_W" -ge "$INPUT_H" ]; then
    OUT_W=1920; OUT_H=1280
  else
    OUT_W=1280; OUT_H=1920
  fi
fi
echo "  orientation: $ORIENTATION -> ${OUT_W}x${OUT_H}"

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

echo "  5/6 forcing DCF marker (R98) + orientation + YCbCr positioning..."
exiftool -overwrite_original \
  "-InteropIndex=R98" \
  "-InteropVersion=0100" \
  "-Orientation=1" \
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

set +u
SIZE_KB=$(($(wc -c < "$OUTPUT" | tr -d ' ') / 1024))
ENCODING=$(exiftool -EncodingProcess -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
SUBSAMPLING=$(exiftool -YCbCrSubSampling -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
MAKE=$(exiftool -Make -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
MODEL=$(exiftool -Model -s -s -s "$OUTPUT" 2>/dev/null || echo "?")
R98=$(exiftool -InteropIndex -s -s -s "$OUTPUT" 2>/dev/null || echo "(missing)")

echo ""
echo "✓ ${OUTPUT}"
echo "  ${OUT_W}×${OUT_H}, ${SIZE_KB} KB"
echo "  Encoding:      ${ENCODING}"
echo "  Subsampling:   ${SUBSAMPLING}"
echo "  Make/Model:    ${MAKE} / ${MODEL}"
echo "  DCF marker:    ${R98}"
echo ""
echo "Drop into DCIM/100MSDCF/ on your SD card and play back on the camera."
