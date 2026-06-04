"""
cli.py — local end-to-end: design images → ready-to-copy SD-card ZIP.

This is a convenience wrapper around pack.build_zip for testing the web
pipeline locally. It is NOT the author's production tool — the hand-used Canva
workflow remains scripts/cardify.sh, untouched.

Examples:
    python -m converter.cli --vendor sony --out cards.zip a.png b.jpg
    python -m converter.cli --vendor sony --out cards.zip ./designs/
"""

from __future__ import annotations

import argparse
import os
import sys

from . import pack
from . import encoder

_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff")


def _collect(paths: list[str]) -> list[tuple[str, bytes]]:
    files: list[str] = []
    for p in paths:
        if os.path.isdir(p):
            for name in sorted(os.listdir(p)):
                if name.lower().endswith(_EXTS):
                    files.append(os.path.join(p, name))
        else:
            files.append(p)
    designs = []
    for f in files:
        with open(f, "rb") as fh:
            designs.append((os.path.basename(f), fh.read()))
    return designs


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build an SD-card ZIP of camera pose cards.")
    ap.add_argument("--vendor", required=True, choices=sorted(encoder.VENDORS))
    ap.add_argument("--out", required=True, help="output .zip path")
    ap.add_argument("--orientation", default="auto", choices=["auto", "landscape", "portrait"])
    ap.add_argument("images", nargs="+", help="image files and/or directories")
    args = ap.parse_args(argv)

    designs = _collect(args.images)
    if not designs:
        print("no images found", file=sys.stderr)
        return 2

    data = pack.build_zip(designs, args.vendor, args.orientation)
    with open(args.out, "wb") as fh:
        fh.write(data)
    print(f"✓ {args.out}  ({len(designs)} cards, {len(data)//1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
