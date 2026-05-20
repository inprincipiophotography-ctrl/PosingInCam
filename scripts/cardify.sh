#!/usr/bin/env bash
#
# scripts/cardify.sh — turn any JPEG into a camera-readable playback card.
#
# Vendor is auto-detected from the template's EXIF Make tag.
#   - Make=SONY  → Sony Alpha output, customer SD path DCIM/100MSDCF/DSC0NNNN.JPG
#   - Make=Canon → Canon EOS output, customer SD path DCIM/100CANON/IMG_NNNN.JPG
# (Nikon, Fujifilm, OM System: not yet supported; extend the case in the
# vendor-detection block and add a regex entry in validate_card().)
#
# Replicates real-camera JPEG storage convention:
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
# Encoders supported:
#   1. ImageMagick (recommended; brew install imagemagick)
#   2. Python 3 + Pillow
#   (sips is intentionally NOT supported — it defaults to 4:2:0 subsampling
#    and progressive JPEG, both of which can be rejected by stricter Sony
#    firmwares. v2 hard-aborts instead of silently producing broken output.)
#
# Usage:
#   scripts/cardify.sh [-l|-p|-a] <template.JPG> <input.jpg> <output.JPG>
#   scripts/cardify.sh --validate <file.JPG>
#
#   -l, --landscape   force landscape output (Orientation=1)
#   -p, --portrait    force portrait output (Orientation=6, rotates correctly
#                     when camera is held vertically)
#   -a, --auto        auto-detect from input aspect ratio (default)
#   --validate <f>    check existing cardified JPEG against the supported
#                     camera spec, no re-encode. Vendor is detected from
#                     the file's own Make tag. Use to diagnose "doesn't play
#                     on camera" reports from end users.

set -euo pipefail

# ---------------------------------------------------------------------------
# Validation gate — verifies a JPEG meets every check needed for camera
# playback. Vendor (Sony or Canon) is auto-detected from the Make tag of
# the file being validated; the Model regex is picked accordingly. Used
# both as the final step of normal runs (catch silent encoder failures)
# and standalone via --validate (diagnose end-user complaints).
#
# Echoes pass/fail per check; returns 0 if all pass, 1 otherwise.
# ---------------------------------------------------------------------------
validate_card() {
  local f="$1"
  if [ ! -f "$f" ]; then
    echo "  ✗ file not found: $f" >&2
    return 1
  fi

  local errs=0
  local val

  check_tag() {
    local tag="$1" expected="$2" desc="$3"
    val=$(exiftool -"$tag" -s -s -s "$f" 2>/dev/null || echo "")
    if [[ "$val" == *"$expected"* ]]; then
      echo "  ✓ $desc: $val"
    else
      echo "  ✗ $desc: got '$val', expected to contain '$expected'" >&2
      errs=$((errs + 1))
    fi
  }

  # Make + Model: vendor is auto-detected from the Make tag of the file under
  # test. Each vendor has its own model-naming convention; the regex below
  # gates against that. To add Nikon / Fujifilm / OM System, extend the case.
  #   Sony Alpha:  Make=SONY,  Model=ILCE-7M3 / ILCE-7M4 / ILCE-1M2 / etc.
  #   Canon EOS R: Make=Canon, Model=Canon EOS R5 / R5m2 / R6 / R6m2 / R6 Mark III / etc.
  local make_val model_val expected_model_pattern vendor_label
  make_val=$(exiftool -Make -s -s -s "$f" 2>/dev/null || echo "")
  case "$make_val" in
    SONY)
      echo "  ✓ Make: $make_val"
      expected_model_pattern='^ILCE-'
      vendor_label='Sony Alpha (ILCE-*)'
      ;;
    Canon)
      echo "  ✓ Make: $make_val"
      expected_model_pattern='^Canon EOS '
      vendor_label='Canon EOS (R / Rm2 / Mark III)'
      ;;
    *)
      echo "  ✗ Make: got '$make_val', expected SONY or Canon" >&2
      errs=$((errs + 1))
      expected_model_pattern=''
      ;;
  esac

  if [ -n "$expected_model_pattern" ]; then
    model_val=$(exiftool -Model -s -s -s "$f" 2>/dev/null || echo "")
    if [[ "$model_val" =~ $expected_model_pattern ]]; then
      echo "  ✓ Model: $model_val"
    else
      echo "  ✗ Model: got '$model_val', expected $vendor_label" >&2
      errs=$((errs + 1))
    fi
  fi

  check_tag EncodingProcess  "Baseline DCT"                    "Encoding"
  check_tag InteropIndex     "R98"                             "DCF marker"
  check_tag ExifImageWidth   "1920"                            "Exif width"
  check_tag ExifImageHeight  "1280"                            "Exif height"

  # Subsampling: accept either 4:2:2 (what cardify.sh produces via ImageMagick)
  # or 4:2:0 (what real Sony camera shots and older cardify samples use). 4:4:4
  # would be unusual and is rejected.
  val=$(exiftool -YCbCrSubSampling -s -s -s "$f" 2>/dev/null || echo "")
  if [[ "$val" == *"YCbCr4:2:2"* ]] || [[ "$val" == *"YCbCr4:2:0"* ]]; then
    echo "  ✓ Subsampling: $val"
  else
    echo "  ✗ Subsampling: got '$val', expected YCbCr4:2:2 or 4:2:0" >&2
    errs=$((errs + 1))
  fi

  val=$(exiftool -Orientation -n -s -s -s "$f" 2>/dev/null || echo "")
  if [ "$val" = "1" ] || [ "$val" = "6" ]; then
    echo "  ✓ Orientation: $val"
  else
    echo "  ✗ Orientation: got '$val', expected 1 (landscape) or 6 (portrait)" >&2
    errs=$((errs + 1))
  fi

  local thumb_bytes
  thumb_bytes=$(exiftool -ThumbnailImage -b "$f" 2>/dev/null | wc -c | tr -d ' ')
  if [ "${thumb_bytes:-0}" -gt 1000 ]; then
    echo "  ✓ Thumbnail: ${thumb_bytes} bytes"
  else
    echo "  ✗ Thumbnail: only ${thumb_bytes:-0} bytes (need > 1000)" >&2
    errs=$((errs + 1))
  fi

  if [ "$errs" -gt 0 ]; then
    echo "  → $errs check(s) failed" >&2
    return 1
  fi
  return 0
}

# --validate mode: short-circuit before regular flag parsing.
if [ "${1:-}" = "--validate" ]; then
  if [ "$#" -ne 2 ]; then
    echo "usage: $0 --validate <file.JPG>" >&2
    exit 1
  fi
  if ! command -v exiftool >/dev/null 2>&1; then
    echo "error: exiftool not installed. Run: brew install exiftool" >&2
    exit 1
  fi
  echo "validating: $2"
  if validate_card "$2"; then
    echo ""
    echo "✓ $2 passes all camera playback checks."
    exit 0
  else
    echo ""
    echo "✗ $2 is NOT spec-compliant. See errors above." >&2
    exit 1
  fi
fi

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

# Auto-detect vendor from the template's Make tag. The output ends up with
# the same Make/Model/MakerNotes as the template (we copy via -tagsFromFile
# -all:all), so the template determines the vendor of the resulting card.
TEMPLATE_MAKE=$(exiftool -Make -s -s -s "$TEMPLATE" 2>/dev/null || echo "")
case "$TEMPLATE_MAKE" in
  SONY)
    VENDOR="sony"
    DCF_FOLDER="100MSDCF"
    DCF_PREFIX="DSC0"
    ;;
  Canon)
    VENDOR="canon"
    DCF_FOLDER="100CANON"
    DCF_PREFIX="IMG_"
    ;;
  *)
    echo "error: unsupported template Make: '$TEMPLATE_MAKE'" >&2
    echo "       Supported: SONY, Canon. Open an issue to request a new vendor." >&2
    exit 1
    ;;
esac
echo "  vendor: $VENDOR (template Make: $TEMPLATE_MAKE)"
echo "  customer SD layout for this vendor: DCIM/$DCF_FOLDER/${DCF_PREFIX}NNNN.JPG"

ENCODER=""
if python3 -c "from PIL import Image" >/dev/null 2>&1; then
  ENCODER="pillow"
else
  echo "error: Pillow (Python imaging) is required for spec-compliant Sony JPEG output." >&2
  echo "       Older Sony bodies (A7 III v4.01 and similar) validate the JPEG" >&2
  echo "       quantization tables against the originating camera's fingerprint." >&2
  echo "       Only Pillow can re-encode using the template's q-tables verbatim;" >&2
  echo "       ImageMagick cannot easily do this." >&2
  echo "       Install: pip3 install Pillow" >&2
  exit 1
fi
echo "  encoder: $ENCODER (Sony q-tables from template)"

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

# 1. Re-encode using the TEMPLATE's quantization tables — this is the key
# insight for older Sony body compatibility (A7 III v4.01 validates the JPEG
# fingerprint and rejects ImageMagick/standard libjpeg encoder output, even
# with otherwise-identical EXIF). Pillow's qtables= argument lets us reuse
# the template's exact DQT entries; optimize=False prevents Huffman
# regeneration that would also fail the fingerprint check.
echo "  1/7 re-encoding (Sony q-tables from template, baseline, 4:2:2)..."
python3 - "$INPUT" "$TEMPLATE" "$OUTPUT" "$PRE_W" "$PRE_H" "$ROTATE" <<'PYEOF'
import sys
from PIL import Image
inp, tpl, out, pw, ph, rot = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]

# Pull Sony's exact quantization tables out of the real-camera template.
template = Image.open(tpl)
qtables = template.quantization
if not qtables:
    print("error: template has no quantization tables — is it a real Sony JPEG?", file=sys.stderr)
    sys.exit(1)

img = Image.open(inp).convert("RGB").resize((pw, ph), Image.LANCZOS)
if rot == "ccw90":
    img = img.transpose(Image.ROTATE_90)  # PIL ROTATE_90 = counter-clockwise 90°
img.save(out, "JPEG", qtables=qtables, subsampling=1, progressive=False, optimize=False)
PYEOF

if [ ! -f "$OUTPUT" ]; then
  echo "error: encoder did not create $OUTPUT" >&2
  exit 1
fi

echo "  2/7 copying Sony EXIF from template..."
exiftool -overwrite_original -tagsFromFile "$TEMPLATE" -all:all "$OUTPUT" >/dev/null 2>&1 || true

echo "  3/7 stripping template-specific + extra metadata..."
exiftool -overwrite_original \
  "-IFD1:all=" \
  "-ExifImageWidth=" \
  "-ExifImageHeight=" \
  "-PreviewImage=" \
  "-ICC_Profile:all=" \
  "-XMP:all=" \
  "-IPTC:all=" \
  "$OUTPUT" >/dev/null 2>&1 || true

echo "  4/7 writing dimensions ${OUT_W}x${OUT_H} into EXIF..."
exiftool -overwrite_original \
  "-ExifImageWidth=$OUT_W" \
  "-ExifImageHeight=$OUT_H" \
  "$OUTPUT" >/dev/null 2>&1 || true

echo "  5/7 setting fixed safe date (2024:01:01 12:00:00)..."
# Template-copied DateTimeOriginal would tie every card to one shoot date and
# can collide with the photographer's real photos in Date View. Pin to a
# neutral past date — recent enough that no firmware suspects corruption, old
# enough that "Recent" filters won't pull these cards in unexpectedly.
exiftool -overwrite_original \
  "-DateTimeOriginal=2024:01:01 12:00:00" \
  "-CreateDate=2024:01:01 12:00:00" \
  "-ModifyDate=2024:01:01 12:00:00" \
  "$OUTPUT" >/dev/null 2>&1 || true

echo "  6/7 forcing DCF marker (R98) + Orientation=$EXIF_ORIENT..."
# YCbCrPositioning=2 (Co-sited) matches what real Sony cameras write. The
# previous version forced =1 (Centered), which A7 IV/V tolerated but A7 III
# v4.01 rejected as part of its JPEG fingerprint validation.
exiftool -overwrite_original -n \
  "-InteropIndex=R98" \
  "-InteropVersion=0100" \
  "-Orientation=$EXIF_ORIENT" \
  "-YCbCrPositioning=2" \
  "$OUTPUT" >/dev/null 2>&1 || true

echo "  7/7 generating + embedding thumbnail (Sony q-tables)..."
THUMB=$(mktemp -t cardify-thumb.XXXXXX).jpg
trap 'rm -f "$THUMB"' EXIT
python3 - "$OUTPUT" "$TEMPLATE" "$THUMB" <<'PYEOF'
import sys
from PIL import Image
out_path, tpl_path, thumb_path = sys.argv[1], sys.argv[2], sys.argv[3]
template = Image.open(tpl_path)
qtables = template.quantization
img = Image.open(out_path).convert("RGB")
img.thumbnail((160, 160), Image.LANCZOS)
img.save(thumb_path, "JPEG", qtables=qtables, subsampling=1, progressive=False, optimize=False)
PYEOF
exiftool -overwrite_original "-ThumbnailImage<=$THUMB" "$OUTPUT" >/dev/null 2>&1

# Strip JFIF/APP0 segment. Pillow (like ImageMagick) automatically adds a
# JFIF marker to every JPEG it writes. Real Sony JPEGs have no JFIF segment
# at all — the file starts with SOI → APP1 (EXIF) → APP2 (MPF). A7 III v4.01
# validates this structure and rejects files with unexpected APP0/JFIF.
exiftool -overwrite_original -JFIF:all= "$OUTPUT" >/dev/null 2>&1 || true

# Defensive: strip any macOS extended attributes the encoder/exiftool might
# have attached. Resource forks travel poorly to FAT32/exFAT SD cards.
xattr -cr "$OUTPUT" 2>/dev/null || true

# Sync filesystem mtime/atime to the pinned EXIF DateTimeOriginal. Some
# older Sony firmwares (notably A7 III with v4.01) appear to validate
# temporal consistency between filesystem timestamps and EXIF dates —
# manually-injected files with mtime far from their declared shoot date
# can be filtered out of playback. Reading the date back from the file
# rather than hardcoding keeps this in sync with step 5/7 above.
TOUCH_DATE=$(exiftool -DateTimeOriginal -s -s -s -d "%Y%m%d%H%M.%S" "$OUTPUT" 2>/dev/null)
if [ -n "$TOUCH_DATE" ]; then
  touch -t "$TOUCH_DATE" "$OUTPUT" 2>/dev/null || true
fi

echo ""
echo "  post-encode validation:"
if ! validate_card "$OUTPUT"; then
  echo "" >&2
  echo "error: output failed post-encode validation. The file is NOT safe to" >&2
  echo "       ship to a camera. See ✗ markers above for which checks failed." >&2
  exit 1
fi

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
