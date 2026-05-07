"""Side-by-side EXIF diff between a real Sony JPEG and a cardify.sh output.

Useful when a card doesn't play back on the camera and you want to see what
EXIF tags the real shot has that ours is missing.

Usage:
    python3 scripts/exif_diff.py --real ~/Desktop/template.JPG \\
                                 --ours ~/Desktop/DSC00099.JPG

Requires `exiftool` on PATH.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def run_exiftool(path: Path) -> dict[str, str]:
    """Return a {tag_with_group: value} dict via `exiftool -G1 -a -s`."""
    result = subprocess.run(
        ["exiftool", "-G1", "-a", "-s", "-charset", "utf8", str(path)],
        capture_output=True,
        text=True,
        check=True,
    )
    out: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        out[key.strip()] = value.strip()
    return out


def diff(real: dict[str, str], ours: dict[str, str]) -> tuple[set[str], set[str], set[str]]:
    """Return (only_in_real, only_in_ours, value_mismatch) tag sets."""
    real_keys = set(real)
    ours_keys = set(ours)
    only_real = real_keys - ours_keys
    only_ours = ours_keys - real_keys
    mismatches = {k for k in real_keys & ours_keys if real[k] != ours[k]}
    return only_real, only_ours, mismatches


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--real", required=True, type=Path, help="A genuine camera JPEG.")
    parser.add_argument("--ours", required=True, type=Path, help="A posingincam-generated JPEG.")
    parser.add_argument(
        "--ignore",
        action="append",
        default=[
            "[File]FileName",
            "[File]Directory",
            "[File]FileSize",
            "[File]FileModifyDate",
            "[File]FileAccessDate",
            "[File]FileInodeChangeDate",
            "[File]FilePermissions",
            "[Composite]ImageSize",
            "[Composite]Megapixels",
        ],
        help="EXIF tag to ignore (can be passed multiple times).",
    )
    args = parser.parse_args()

    if not shutil.which("exiftool"):
        print("error: exiftool not found on PATH; install it and retry.", file=sys.stderr)
        return 2

    real_tags = run_exiftool(args.real)
    ours_tags = run_exiftool(args.ours)
    for k in args.ignore:
        real_tags.pop(k, None)
        ours_tags.pop(k, None)

    only_real, only_ours, mismatches = diff(real_tags, ours_tags)

    print(f"\nReal: {args.real}  ({len(real_tags)} tags)")
    print(f"Ours: {args.ours}  ({len(ours_tags)} tags)")

    if only_real:
        print(f"\n--- {len(only_real)} tags ONLY in REAL (likely required) ---")
        for k in sorted(only_real):
            print(f"  {k}: {real_tags[k]}")

    if only_ours:
        print(f"\n--- {len(only_ours)} tags ONLY in OURS (probably fine) ---")
        for k in sorted(only_ours):
            print(f"  {k}: {ours_tags[k]}")

    if mismatches:
        print(f"\n--- {len(mismatches)} tags with VALUE MISMATCH ---")
        for k in sorted(mismatches):
            print(f"  {k}")
            print(f"    real: {real_tags[k]}")
            print(f"    ours: {ours_tags[k]}")

    if not (only_real or only_ours or mismatches):
        print("\n✓ EXIF tags match (modulo --ignore).")
        return 0

    return 1 if only_real else 0


if __name__ == "__main__":
    raise SystemExit(main())
