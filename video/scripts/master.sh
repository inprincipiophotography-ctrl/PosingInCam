#!/usr/bin/env bash
# Master a rendered ad's sound for Reels: measure, gain to the target loudness, true-peak limiter.
# Video stream copied untouched.
#   scripts/master.sh out/AdA5-9x16.mp4 [targetLufs=-14]   → out/AdA5-9x16-master.mp4
set -euo pipefail
in="$1"; target="${2:--14}"; out="${in%.mp4}-master.mp4"
loud() { ffmpeg -hide_banner -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk '/Summary/{s=1} s&&/ I:/{print $2; exit}'; }
gain=$(python3 -c "print(round($target - ($(loud "$in")), 2))")
ffmpeg -hide_banner -loglevel error -y -i "$in" -c:v copy \
  -af "volume=${gain}dB,alimiter=limit=0.79:attack=1:release=50:level=false,aresample=48000" \
  -c:a aac -b:a 256k -movflags +faststart "$out"
echo "  gain ${gain} dB"
ffmpeg -hide_banner -i "$out" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | sed "s|^|  $out |"
