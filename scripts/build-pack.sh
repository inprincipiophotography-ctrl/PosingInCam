#!/usr/bin/env bash
#
# scripts/build-pack.sh — bulk wrapper around cardify.sh.
#
# Replaces the multi-line shell loop maintainers used to copy-paste for every
# new pose pack. Takes a camera template + a source (ZIP or directory of Canva
# exports), auto-detects the vendor from the template's Make tag, picks the
# right output filename pattern (DSC%05d.JPG for Sony, IMG_%04d.JPG for
# Canon), and produces a ready-to-deploy pack folder.
#
# Usage:
#   scripts/build-pack.sh <template.JPG> <input.zip | input-dir> [output-dir]
#
#   <template.JPG>     Real-camera SOOC used as the EXIF / q-table source.
#                      Must be from a Sony Alpha (SONY Make) or Canon EOS
#                      (Canon Make) body.
#   <input.zip|dir>    Either a ZIP file of Canva JPEGs or a directory of
#                      JPEGs. ZIPs are extracted next to themselves.
#   [output-dir]       Optional. Defaults to "<source-stem>-pack/" placed
#                      next to the input source.
#
# Examples:
#   scripts/build-pack.sh ~/Desktop/TEMPLATE-A7III.JPG ~/Desktop/SONY-DAY.zip
#   scripts/build-pack.sh ~/Desktop/TEMPLATE-R6M2.JPG ~/Desktop/canva-canon/

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "usage: $0 <template.JPG> <input.zip | input-dir> [output-dir]" >&2
  exit 1
fi

TEMPLATE="$1"
SOURCE="$2"
OUT="${3:-}"

# Validate template + locate cardify next to this script.
if [ ! -f "$TEMPLATE" ]; then
  echo "error: template not found: $TEMPLATE" >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
CARDIFY="$SCRIPT_DIR/cardify.sh"
if [ ! -x "$CARDIFY" ]; then
  echo "error: cardify.sh expected next to build-pack.sh at $CARDIFY" >&2
  exit 1
fi

if ! command -v exiftool >/dev/null 2>&1; then
  echo "error: exiftool not installed. Run: brew install exiftool" >&2
  exit 1
fi

# Detect vendor from template Make → pick output filename pattern.
MAKE=$(exiftool -Make -s -s -s "$TEMPLATE" 2>/dev/null || echo "")
case "$MAKE" in
  SONY)
    PATTERN="DSC%05d.JPG"
    ;;
  Canon)
    PATTERN="IMG_%04d.JPG"
    ;;
  *)
    echo "error: unsupported template vendor: '$MAKE'" >&2
    echo "       Supported: SONY, Canon." >&2
    exit 1
    ;;
esac

# Handle ZIP source or directory source. ZIPs extract next to themselves
# into a folder named after the ZIP stem; idempotent if the folder already
# exists.
if [[ "$SOURCE" == *.zip ]]; then
  if [ ! -f "$SOURCE" ]; then
    echo "error: ZIP not found: $SOURCE" >&2
    exit 1
  fi
  STEM=$(basename "$SOURCE" .zip)
  PARENT=$(cd "$(dirname "$SOURCE")" && pwd)
  INPUT_DIR="$PARENT/$STEM"
  if [ ! -d "$INPUT_DIR" ]; then
    echo "  unzipping $SOURCE → $INPUT_DIR"
    unzip -q "$SOURCE" -d "$INPUT_DIR"
  fi
else
  if [ ! -d "$SOURCE" ]; then
    echo "error: input directory not found: $SOURCE" >&2
    exit 1
  fi
  INPUT_DIR=$(cd "$SOURCE" && pwd)
  STEM=$(basename "$INPUT_DIR")
fi

# Default output dir: <stem>-pack next to the source.
if [ -z "$OUT" ]; then
  OUT="$(dirname "$INPUT_DIR")/${STEM}-pack"
fi
mkdir -p "$OUT"

# Collect inputs (case-insensitive .jpg) and sort naturally so 10.jpg comes
# after 9.jpg, not after 1.jpg.
INPUTS=()
while IFS= read -r f; do
  INPUTS+=("$f")
done < <(find "$INPUT_DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) | sort -V)

TOTAL=${#INPUTS[@]}
if [ "$TOTAL" -eq 0 ]; then
  echo "error: no .jpg files found in $INPUT_DIR" >&2
  exit 1
fi

echo ""
echo "Template: $TEMPLATE  (vendor: $MAKE)"
echo "Source:   $INPUT_DIR  ($TOTAL file(s))"
echo "Output:   $OUT"
echo ""

COUNTER=1
for input in "${INPUTS[@]}"; do
  output="$OUT/$(printf "$PATTERN" "$COUNTER")"
  printf "  %2d/%d  %-32s → %s\n" "$COUNTER" "$TOTAL" "$(basename "$input")" "$(basename "$output")"
  if ! "$CARDIFY" -a "$TEMPLATE" "$input" "$output" >/dev/null 2>&1; then
    echo "  ✗ cardify failed on: $input" >&2
    echo "    re-run manually to see error:" >&2
    echo "    $CARDIFY -a $TEMPLATE $input $output" >&2
    exit 1
  fi
  COUNTER=$((COUNTER + 1))
done

echo ""
echo "✓ $((COUNTER - 1)) cards built. Output: $OUT"
