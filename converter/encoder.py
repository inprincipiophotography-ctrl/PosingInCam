"""
encoder.py — pure-Python port of the PosingInCam camera-card conversion.

This is a NEW, self-contained reimplementation of the *behaviour* of
``scripts/cardify.sh`` using only Pillow + piexif (no exiftool, no Perl), so it
can run inside a Vercel Python serverless function.

⚠️  It does NOT touch, import, or modify ``scripts/cardify.sh`` — that CLI is the
    author's hand-used Canva workflow and stays exactly as-is. This module only
    *reads* a real-camera template JPEG for its quantization tables + Make/Model.

What it reproduces (see scripts/cardify.sh for the verified reference):
  * output is ALWAYS 1920x1280 pixels (landscape on disk)
  * portrait content is rotated 90° CCW into that canvas + EXIF Orientation=6
  * JPEG: baseline DCT, YCbCr 4:2:2, template quantization tables verbatim
    (Pillow ``qtables=``, ``optimize=False`` so the q-table fingerprint survives)
  * NO JFIF/APP0 segment (real Sony JPEGs start SOI→APP1)
  * EXIF: Make/Model from template, InteropIndex=R98 (DCF marker),
    Orientation 1/6, ExifImage W/H 1920/1280, fixed safe date, YCbCrPositioning=2,
    a fresh ~160px embedded thumbnail

MakerNotes are intentionally omitted: the reference validator does not require
them and the hardware-confirmed sample ships without them. If a strict body ever
rejects the output, the documented fallback is the Docker+exiftool path.
"""

from __future__ import annotations

import io
import copy
import struct
from dataclasses import dataclass

from PIL import Image
import PIL.JpegImagePlugin as JpegPlugin
import piexif

# --- output spec (mirrors cardify.sh:294-308) --------------------------------
OUT_W = 1920
OUT_H = 1280
FIXED_DATE = b"2024:01:01 12:00:00"  # cardify.sh:375-379

# Interop IFD tag numbers (piexif's named constants are unreliable across versions)
_INTEROP_INDEX = 1     # "R98" → DCF basic-file marker
_INTEROP_VERSION = 2   # b"0100"


@dataclass(frozen=True)
class Vendor:
    key: str
    folder: str   # DCF folder on the SD card
    prefix: str   # DCF filename prefix
    template: str # template filename inside converter/templates/
    make: str     # expected EXIF Make (for validation)
    model_prefix: str  # expected EXIF Model prefix (for validation)


# Vendor → SD layout (mirrors cardify.sh:234-260). Numbering uses 4 digits in the
# 9000+ range so cards never collide with the photographer's real shots.
VENDORS: dict[str, Vendor] = {
    "sony":  Vendor("sony",  "100MSDCF", "DSC0", "sony.JPG",  "SONY",  "ILCE-"),
    "canon": Vendor("canon", "100CANON", "IMG_", "canon.JPG", "Canon", "Canon EOS "),
    "nikon": Vendor("nikon", "100NCZ_X", "DSC_", "nikon.JPG", "NIKON CORPORATION", "NIKON Z"),
}

START_NUMBER = 9000


def filename_for(vendor: str, index: int) -> str:
    """Card filename for the index-th card (0-based), e.g. sony,0 -> DSC09000.JPG."""
    v = VENDORS[vendor]
    return f"{v.prefix}{START_NUMBER + index:04d}.JPG"


# -----------------------------------------------------------------------------
# JPEG segment surgery
# -----------------------------------------------------------------------------
def _rebuild_jpeg(jpg: bytes, app1: bytes | None) -> bytes:
    """Return *jpg* with APP0(JFIF) and any APP1 removed, and (optionally) *app1*
    inserted right after SOI. Everything else (DQT/DHT/SOF/SOS + entropy data)
    is preserved byte-for-byte."""
    if jpg[:2] != b"\xff\xd8":
        raise ValueError("not a JPEG (missing SOI)")
    out = bytearray(b"\xff\xd8")
    if app1:
        out += app1
    i = 2
    n = len(jpg)
    while i < n:
        if jpg[i] != 0xFF:
            out += jpg[i:]
            break
        marker = jpg[i + 1]
        if marker == 0xDA:  # SOS: copy the rest of the file verbatim
            out += jpg[i:]
            break
        if marker == 0xD9:  # EOI
            out += jpg[i:i + 2]
            i += 2
            continue
        if 0xD0 <= marker <= 0xD7 or marker == 0x01:  # standalone, no length
            out += jpg[i:i + 2]
            i += 2
            continue
        seglen = struct.unpack(">H", jpg[i + 2:i + 4])[0]
        seg = jpg[i:i + 2 + seglen]
        if marker not in (0xE0, 0xE1):  # drop APP0/APP1, keep everything else
            out += seg
        i += 2 + seglen
    return bytes(out)


def _frame_app1(exif_bytes: bytes) -> bytes:
    """Wrap piexif.dump() output into a JPEG APP1 segment."""
    return b"\xff\xe1" + struct.pack(">H", len(exif_bytes) + 2) + exif_bytes


def _sof_marker(jpg: bytes) -> int | None:
    """Return the SOF marker byte (0xC0 baseline, 0xC2 progressive, ...) or None."""
    i = 2
    n = len(jpg)
    while i < n:
        if jpg[i] != 0xFF:
            return None
        marker = jpg[i + 1]
        if marker == 0xDA or marker == 0xD9:
            return None
        if 0xD0 <= marker <= 0xD7 or marker == 0x01:
            i += 2
            continue
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            return marker
        seglen = struct.unpack(">H", jpg[i + 2:i + 4])[0]
        i += 2 + seglen
    return None


def _has_app0(jpg: bytes) -> bool:
    i = 2
    n = len(jpg)
    while i < n and jpg[i] == 0xFF:
        marker = jpg[i + 1]
        if marker in (0xDA, 0xD9):
            break
        if 0xD0 <= marker <= 0xD7 or marker == 0x01:
            i += 2
            continue
        if marker == 0xE0:
            return True
        seglen = struct.unpack(">H", jpg[i + 2:i + 4])[0]
        i += 2 + seglen
    return False


# -----------------------------------------------------------------------------
# Conversion
# -----------------------------------------------------------------------------
def _resolve_orientation(image: Image.Image, orientation: str) -> str:
    if orientation == "auto":
        w, h = image.size
        return "landscape" if w >= h else "portrait"
    if orientation not in ("landscape", "portrait"):
        raise ValueError(f"orientation must be auto|landscape|portrait, got {orientation!r}")
    return orientation


def _encode_with_qtables(image: Image.Image, qtables) -> bytes:
    """Pillow JPEG encode reusing the template's exact q-tables (cardify.sh:333-336)."""
    buf = io.BytesIO()
    image.save(buf, "JPEG", qtables=qtables, subsampling=1, progressive=False, optimize=False)
    return buf.getvalue()


def _make_thumbnail(card: Image.Image, qtables) -> bytes:
    thumb = card.copy()
    thumb.thumbnail((160, 160), Image.LANCZOS)
    raw = _encode_with_qtables(thumb, qtables)
    return _rebuild_jpeg(raw, app1=None)  # strip JFIF from the embedded thumb too


def _build_exif(exif_base: dict, exif_orient: int, thumb: bytes) -> bytes:
    """Build the output EXIF by cloning the template's real-camera EXIF and
    surgically overriding the parts that must differ for our card — the same
    philosophy as cardify.sh's ``-tagsFromFile -all:all`` then targeted edits
    (cardify.sh:345-390), but in pure Python. MakerNotes are intentionally left
    out (see module docstring)."""
    ex = copy.deepcopy(exif_base)
    ex.setdefault("0th", {})
    ex.setdefault("Exif", {})

    ex["0th"][piexif.ImageIFD.Orientation] = exif_orient
    ex["0th"][piexif.ImageIFD.YCbCrPositioning] = 2          # Co-sited (cardify.sh:389)
    ex["0th"][piexif.ImageIFD.DateTime] = FIXED_DATE
    ex["Exif"][piexif.ExifIFD.DateTimeOriginal] = FIXED_DATE  # cardify.sh:375-379
    ex["Exif"][piexif.ExifIFD.DateTimeDigitized] = FIXED_DATE
    ex["Exif"][piexif.ExifIFD.PixelXDimension] = OUT_W        # ExifImageWidth  (cardify.sh:365-368)
    ex["Exif"][piexif.ExifIFD.PixelYDimension] = OUT_H        # ExifImageHeight
    ex["Exif"].pop(piexif.ExifIFD.MakerNote, None)           # never carry MakerNotes

    ex["Interop"] = {_INTEROP_INDEX: b"R98"}                  # DCF marker (cardify.sh:386)
    ex["GPS"] = {}
    ex["1st"] = {
        piexif.ImageIFD.Compression: 6,
        piexif.ImageIFD.XResolution: (72, 1),
        piexif.ImageIFD.YResolution: (72, 1),
        piexif.ImageIFD.ResolutionUnit: 2,
        piexif.ImageIFD.Orientation: exif_orient,
    }
    ex["thumbnail"] = thumb
    return piexif.dump(ex)


def template_meta(template_path: str) -> tuple[list, dict]:
    """Return (qtables, exif_base) read from a real-camera template JPEG.

    qtables is normalised to a list-of-tables (each 64 ints), the format Pillow's
    ``save(qtables=...)`` accepts most reliably across versions.

    exif_base is the template's EXIF (so the output inherits Make/Model and the
    full standard tag set of a real shot), with the per-card / unsafe parts
    removed: MakerNotes (offset-fragile + not load-bearing), the template's own
    thumbnail/IFD1, and GPS.
    """
    tpl = Image.open(template_path)
    if not tpl.quantization:
        raise ValueError("template has no quantization tables — is it a real camera JPEG?")
    qtables = [list(tpl.quantization[k]) for k in sorted(tpl.quantization)]

    ex = piexif.load(template_path)
    ex.setdefault("0th", {})
    ex.setdefault("Exif", {})
    ex["Exif"].pop(piexif.ExifIFD.MakerNote, None)
    ex.pop("1st", None)
    ex["thumbnail"] = None
    ex["GPS"] = {}
    ex["Interop"] = {}
    return qtables, ex


def convert(image_bytes: bytes, template_path: str, orientation: str = "auto") -> bytes:
    """Convert a design image into a camera-ready playback-card JPEG.

    Args:
        image_bytes: the user's design export (any size / format Pillow can open).
        template_path: a real straight-out-of-camera JPEG for this vendor.
        orientation: "auto" (from input aspect), "landscape", or "portrait".

    Returns:
        JPEG bytes: 1920x1280, baseline 4:2:2, template q-tables, DCF/EXIF set.
    """
    qtables, exif_base = template_meta(template_path)
    return convert_with(image_bytes, qtables, exif_base, orientation)


def convert_with(image_bytes: bytes, qtables: list, exif_base: dict,
                 orientation: str = "auto") -> bytes:
    """Like convert(), but with template metadata already read — lets a batch
    read the template once and reuse it for every card."""
    src = Image.open(io.BytesIO(image_bytes))
    orientation = _resolve_orientation(src, orientation)
    if orientation == "portrait":
        pre_w, pre_h, rotate, exif_orient = 1280, 1920, True, 6
    else:
        pre_w, pre_h, rotate, exif_orient = 1920, 1280, False, 1

    card = src.convert("RGB").resize((pre_w, pre_h), Image.LANCZOS)
    if rotate:
        card = card.transpose(Image.ROTATE_90)  # PIL ROTATE_90 == CCW (cardify.sh:335)

    raw = _encode_with_qtables(card, qtables)
    thumb = _make_thumbnail(card, qtables)
    app1 = _frame_app1(_build_exif(exif_base, exif_orient, thumb))
    return _rebuild_jpeg(raw, app1)
