"""Walks a built output tree and asserts DCF compliance.

Run as a function from tests, or directly: `python -m tests.dcf_validator dist/sony-a7iv`.
"""

from __future__ import annotations

import re
import sys
from io import BytesIO
from pathlib import Path

import piexif
from PIL import Image

FOLDER_RE = re.compile(r"^[1-9]\d{2}[A-Z0-9_]{5}$")
FILE_RE = re.compile(r"^[A-Z0-9_]{4}\d{4}\.JPG$")


class DCFViolation(Exception):
    pass


def validate_tree(root: Path) -> list[str]:
    """Return a list of human-readable violations; empty list = compliant."""
    violations: list[str] = []
    dcim = root / "DCIM"
    if not dcim.is_dir():
        return [f"missing DCIM directory at {dcim}"]

    for sub in dcim.iterdir():
        if not sub.is_dir():
            violations.append(f"non-directory in DCIM: {sub.name}")
            continue
        if not FOLDER_RE.match(sub.name):
            violations.append(
                f"folder name {sub.name!r} violates DCF NNNXXXXX (NNN=100-999)"
            )

        for f in sub.iterdir():
            if f.suffix.upper() != ".JPG":
                continue
            if not FILE_RE.match(f.name):
                violations.append(f"file {f.name!r} violates DCF XXXXNNNN.JPG")
                continue

            try:
                img = Image.open(f)
                img.verify()
            except Exception as exc:  # noqa: BLE001
                violations.append(f"{f.name}: not a valid JPEG ({exc})")
                continue

            try:
                exif = piexif.load(str(f))
            except Exception as exc:  # noqa: BLE001
                violations.append(f"{f.name}: EXIF load failed ({exc})")
                continue

            zeroth = exif.get("0th", {})
            for required, label in (
                (piexif.ImageIFD.Make, "Make"),
                (piexif.ImageIFD.Model, "Model"),
                (piexif.ImageIFD.Orientation, "Orientation"),
            ):
                if required not in zeroth:
                    violations.append(f"{f.name}: missing required EXIF {label}")

            thumb = exif.get("thumbnail")
            if not thumb:
                violations.append(f"{f.name}: missing embedded EXIF thumbnail")
                continue
            try:
                timg = Image.open(BytesIO(thumb))
                if timg.format != "JPEG":
                    violations.append(f"{f.name}: thumbnail not JPEG ({timg.format})")
                if timg.size != (160, 120):
                    violations.append(
                        f"{f.name}: thumbnail size {timg.size} != (160, 120)"
                    )
            except Exception as exc:  # noqa: BLE001
                violations.append(f"{f.name}: thumbnail unreadable ({exc})")

    return violations


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python -m tests.dcf_validator <output-dir>", file=sys.stderr)
        return 2
    violations = validate_tree(Path(sys.argv[1]))
    if violations:
        for v in violations:
            print(f"  ✗ {v}")
        print(f"\n{len(violations)} violation(s)")
        return 1
    print("✓ DCF compliant")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
