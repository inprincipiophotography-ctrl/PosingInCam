"""
selftest.py — verify encoder.py output against the camera-card spec.

Runs entirely in pure Python (Pillow + piexif), mirroring the checks in
``scripts/cardify.sh`` validate_card() (lines 71-172) so we don't need exiftool.
The reference CLI is never invoked or modified.

Usage:
    python -m converter.selftest            # uses bundled templates/
    python converter/selftest.py
"""

from __future__ import annotations

import io
import os
import sys

from PIL import Image, ImageDraw
import PIL.JpegImagePlugin as JpegPlugin
import piexif

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from converter import encoder  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATES = os.path.join(HERE, "templates")
OUT_DIR = "/tmp/posingincam-selftest"


def _make_design(w: int, h: int, label: str) -> bytes:
    """A throwaway gradient + label image standing in for a Canva export."""
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(0, w, 8):  # step for speed; fill 8px blocks
            r = int(255 * x / w)
            g = int(255 * y / h)
            b = 128
            for dx in range(8):
                if x + dx < w:
                    px[x + dx, y] = (r, g, b)
    d = ImageDraw.Draw(img)
    d.rectangle([w // 2 - 220, h // 2 - 60, w // 2 + 220, h // 2 + 60], fill=(20, 38, 32))
    d.text((w // 2 - 200, h // 2 - 30), label, fill=(251, 248, 242))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def validate(out: bytes, vendor: str, expect_orient: int) -> list[tuple[str, bool, str]]:
    v = encoder.VENDORS[vendor]
    im = Image.open(io.BytesIO(out))
    ex = piexif.load(out)
    sof = encoder._sof_marker(out)
    sampling = JpegPlugin.get_sampling(im)
    make = ex["0th"].get(piexif.ImageIFD.Make, b"")
    model = ex["0th"].get(piexif.ImageIFD.Model, b"")
    make = make.decode(errors="replace") if isinstance(make, bytes) else str(make)
    model = model.decode(errors="replace") if isinstance(model, bytes) else str(model)
    orient = ex["0th"].get(piexif.ImageIFD.Orientation)
    interop = ex.get("Interop", {}).get(encoder._INTEROP_INDEX, b"")
    interop = interop.decode(errors="replace") if isinstance(interop, bytes) else str(interop)
    pxw = ex["Exif"].get(piexif.ExifIFD.PixelXDimension)
    pxh = ex["Exif"].get(piexif.ExifIFD.PixelYDimension)
    thumb = ex.get("thumbnail") or b""

    checks = [
        ("pixels 1920x1280",   im.size == (1920, 1280),            str(im.size)),
        ("baseline DCT (SOF0)", sof == 0xC0,                        hex(sof) if sof else "none"),
        ("no JFIF/APP0",       not encoder._has_app0(out),          "absent" if not encoder._has_app0(out) else "PRESENT"),
        ("Make",               make == v.make,                      make),
        ("Model prefix",       model.startswith(v.model_prefix),    model),
        ("DCF marker R98",     interop == "R98",                    interop),
        ("ExifImageWidth",     pxw == 1920,                         str(pxw)),
        ("ExifImageHeight",    pxh == 1280,                         str(pxh)),
        ("Orientation",        orient == expect_orient,             f"{orient} (want {expect_orient})"),
        ("subsampling 4:2:2/0", sampling in (1, 2),                 {0: "4:4:4", 1: "4:2:2", 2: "4:2:0"}.get(sampling, str(sampling))),
        ("thumbnail >1000B",   len(thumb) > 1000,                   f"{len(thumb)}B"),
        ("re-openable",        im.verify() is None,                 "ok"),
    ]
    return checks


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    try:
        template = encoder.template_path_for("sony")
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 2

    cases = [
        ("landscape", _make_design(2400, 1600, "POSE LANDSCAPE"), 1),
        ("portrait",  _make_design(1600, 2400, "POSE PORTRAIT"), 6),
    ]
    all_ok = True
    for name, design, expect_orient in cases:
        out = encoder.convert(design, template, orientation="auto")
        path = os.path.join(OUT_DIR, encoder.filename_for("sony", 0 if name == "landscape" else 1))
        with open(path, "wb") as fh:
            fh.write(out)
        print(f"\n=== sony / {name} → {path}  ({len(out)//1024} KB) ===")
        for label, ok, detail in validate(out, "sony", expect_orient):
            print(f"  {'✓' if ok else '✗'} {label}: {detail}")
            all_ok = all_ok and ok

    # --- packaging: build an SD-card ZIP and verify its layout ---------------
    import zipfile
    from converter import pack
    designs = [
        ("a.png", _make_design(2400, 1600, "POSE 1")),
        ("b.png", _make_design(1600, 2400, "POSE 2")),
    ]
    zip_bytes = pack.build_zip(designs, "sony", "auto")
    zpath = os.path.join(OUT_DIR, "cards.zip")
    with open(zpath, "wb") as fh:
        fh.write(zip_bytes)
    names = zipfile.ZipFile(io.BytesIO(zip_bytes)).namelist()
    print(f"\n=== pack → {zpath}  ({len(zip_bytes)//1024} KB) ===")
    expected = [
        "DCIM/100MSDCF/DSC00001.JPG",
        "DCIM/100MSDCF/DSC00002.JPG",
        "README.txt",
    ]
    for name in expected:
        ok = name in names
        print(f"  {'✓' if ok else '✗'} contains {name}")
        all_ok = all_ok and ok

    print("\n" + ("✓ ALL CHECKS PASSED" if all_ok else "✗ SOME CHECKS FAILED"))
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
