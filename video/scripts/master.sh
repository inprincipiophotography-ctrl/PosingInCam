#!/usr/bin/env bash
# Master a rendered ad's sound for Reels: gain into a true-peak limiter, video stream copied untouched.
#   scripts/master.sh out/AdA5-9x16.mp4 [gainDb=5.5]   → out/AdA5-9x16-master.mp4
# The SFX transients (clicks, hits) sit ~5 dB above the body of the mix; the limiter shaves only those,
# which brings the whole ad to about −14 LUFS with peaks under −1 dBTP.
set -euo pipefail
in="$1"; gain="${2:-5.5}"; out="${in%.mp4}-master.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$in" -c:v copy \
  -af "volume=${gain}dB,alimiter=limit=0.79:attack=1:release=50:level=false,aresample=48000" \
  -c:a aac -b:a 256k -movflags +faststart "$out"
ffmpeg -hide_banner -i "$out" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | sed "s|^|  $out |"
