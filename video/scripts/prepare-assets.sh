#!/usr/bin/env bash
# Turn the camera originals in video/source/ into files Remotion can use.
#   photos  → video/public/photos/*.jpg   (2400 px wide, enough for a 2× push-in at 1080p)
#   footage → video/public/footage/*.mp4  (H.264 8-bit: Chromium can't reliably decode HEVC 10-bit)
#   full    → video/public/photos/full/   (The First Look at full size, for the push-in to its words in Ad A v2)
#   site    → video/public/showcase/      (pose-pack cards and photos already on the website)
# All output folders are git-ignored; run this once after a fresh clone.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p public/photos/full public/footage public/showcase

for f in source/*.jpg; do
  out="public/photos/$(basename "$f")"
  [ -s "$out" ] && continue
  ffmpeg -v error -y -i "$f" -vf "scale=2400:-2" -q:v 2 "$out"
  echo "✓ $out"
done

[ -s public/photos/full/DSC08435.jpg ] || { cp source/DSC08435.jpg public/photos/full/ && echo "✓ public/photos/full/DSC08435.jpg"; }

for f in source/*.mp4; do
  out="public/footage/$(basename "$f")"
  [ -s "$out" ] && continue
  ffmpeg -v error -y -i "$f" -an -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p \
    -movflags +faststart "$out"
  echo "✓ $out"
done

cp ../assets/showcase/pack-0*.jpg ../assets/showcase/live-couple.jpg public/showcase/
echo "✓ public/showcase/"
