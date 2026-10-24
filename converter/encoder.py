"""
encoder.py — pure-Python port of the PosingInCam camera-card conversion.

This is a NEW, self-contained reimplementation of the *behaviour* of
``scripts/cardify.sh`` using only Pillow (no exiftool, no Perl), so it
can run inside a Vercel Python serverless function.

⚠️  It does NOT touch, import, or modify ``scripts/cardify.sh`` — that CLI is the
    author's hand-used Canva workflow and stays exactly as-is. This module only
    *reads* a real-camera template JPEG for its quantization tables + EXIF block.

What it reproduces (see scripts/cardify.sh for the verified reference):
  * output is ALWAYS 1920x1280 pixels (landscape on disk)
  * portrait content is rotated 90° CCW into that canvas + EXIF Orientation=6
  * JPEG: baseline DCT, YCbCr 4:2:2, template quantization tables verbatim
    (Pillow ``qtables=``, ``optimize=False`` so the q-table fingerprint survives)
  * NO JFIF/APP0 segment (real Sony JPEGs start SOI→APP1)
  * EXIF: Make/Model from template, InteropIndex=R98 (DCF marker),
    Orientation 1/6, ExifImage W/H 1920/1280, fixed safe date, YCbCrPositioning=2,
    a fresh ~160px embedded thumbnail

EXIF is NOT rebuilt: the template's own EXIF block (APP1) is reused byte for
byte (same byte order, same tag layout, MakerNotes included) and only a handful
of values are overwritten *in place* — Orientation, dates, ExifImage W/H,
YCbCrPositioning — plus a fresh thumbnail written into the template's own
thumbnail slot. Nothing inside the block moves, so the MakerNote's internal
offsets stay valid. This matches what the hardware-verified cardify.sh does
(``exiftool -tagsFromFile -all:all`` then targeted edits), which played back on
Sony A7 III/IV/V, Canon R6 II/III and Nikon Z8/Z9 (docs/CAMERA_TEST_RESULTS.md).

The template owner's identifying tags (Artist, Copyright, ImageUniqueID,
CameraOwnerName, Body/Lens serial) are blanked to NULs and GPS values zeroed so
they never ship to customers. The binary MakerNote is kept verbatim, exactly
as in the tested cards.
"""

from __future__ import annotations

import io
import os
import struct
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFont, ImageOps
import PIL.JpegImagePlugin as JpegPlugin

# --- output spec (mirrors cardify.sh:294-308) --------------------------------
OUT_W = 1920
OUT_H = 1280
FIXED_DATE = b"2024:01:01 12:00:00"  # cardify.sh:375-379

# Reject inputs whose header pixel count exceeds this (decompression-bomb / OOM
# guard). Checked before the image is decoded, so a crafted file can't blow up
# the function's memory. 40 MP is generous for any real design or photo.
MAX_INPUT_PIXELS = 40_000_000

# Interop IFD tag number
_INTEROP_INDEX = 1     # "R98" → DCF basic-file marker

# Owner-identifying tags a real template carries; blanked in every card.
_IDENTIFYING_0TH = (0x013B, 0x8298)                    # Artist, Copyright
_IDENTIFYING_EXIF = (0xA420, 0xA430, 0xA431, 0xA435)   # ImageUniqueID, CameraOwnerName,
                                                       # BodySerialNumber, LensSerialNumber

# Tag numbers used by the in-place EXIF patch.
_T_ORIENTATION = 0x0112
_T_DATETIME = 0x0132
_T_YCBCR_POS = 0x0213
_T_IMAGE_W, _T_IMAGE_H = 0x0100, 0x0101
_T_EXIF_IFD, _T_GPS_IFD, _T_INTEROP_IFD = 0x8769, 0x8825, 0xA005
_T_DATE_ORIGINAL, _T_DATE_DIGITIZED = 0x9003, 0x9004
_T_PIXEL_X, _T_PIXEL_Y = 0xA002, 0xA003
_T_MAKE, _T_MAKERNOTE = 0x010F, 0x927C
_T_THUMB_OFFSET, _T_THUMB_LENGTH = 0x0201, 0x0202
_T_GPS_VERSION = 0x0000
_APP1_MAX_PAYLOAD = 65533  # 0xFFFF minus the 2-byte length field


@dataclass(frozen=True)
class Vendor:
    key: str
    folder: str          # default DCF folder on the SD card
    default_prefix: str  # fallback prefix, only if the template filename isn't DCF-form
    make: str            # expected EXIF Make (for validation)
    model_prefix: str    # expected EXIF Model prefix (for validation)


# Vendor → SD layout (mirrors cardify.sh:234-260 + docs/CAMERA_COMPATIBILITY.md).
# IMPORTANT: the real output PREFIX is read from the template's own DCF filename
# (build-pack.sh:83-98) — e.g. a Canon body whose files are named 0A0A3799.JPG
# yields prefix "0A0A", not "IMG_". default_prefix is only used when the template
# was renamed away from its DCF name. Cards are numbered 0001.. (4 digits; DCF
# rule CAMERA_COMPATIBILITY.md:16 — NNNN ∈ 0001..9999).
VENDORS: dict[str, Vendor] = {
    "sony":  Vendor("sony",  "100MSDCF", "DSC0", "SONY",  "ILCE-"),
    "canon": Vendor("canon", "100CANON", "IMG_", "Canon", "Canon EOS "),
    "nikon": Vendor("nikon", "100NCZ_X", "DSC_", "NIKON CORPORATION", "NIKON Z"),
}

START_NUMBER = 1

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
_IMG_EXTS = (".jpg", ".jpeg")


def template_path_for(vendor: str, templates_dir: str = TEMPLATES_DIR) -> str:
    """Return the bundled SOOC template for a vendor.

    Templates live in per-vendor folders (templates/<vendor>/) under their REAL
    camera filename, so the DCF prefix can be read off the name exactly like
    build-pack.sh does.
    """
    vdir = os.path.join(templates_dir, vendor)
    if os.path.isdir(vdir):
        for name in sorted(os.listdir(vdir)):
            if name.lower().endswith(_IMG_EXTS):
                return os.path.join(vdir, name)
    raise FileNotFoundError(
        f"no template for {vendor}: drop a real straight-out-of-camera JPEG "
        f"(keep its original filename, e.g. 0A0A3799.JPG) into "
        f"converter/templates/{vendor}/"
    )


def dcf_prefix(template_path: str, default: str) -> str:
    """The 4-char DCF filename prefix to use for output cards.

    Mirrors build-pack.sh:83-90: if the template's filename is a real DCF name
    (8 chars, last 4 are digits — e.g. 0A0A3799, IMG_5000, DSC09014) reuse its
    first 4 chars; otherwise fall back to the vendor default.
    """
    stem = os.path.splitext(os.path.basename(template_path))[0]
    if len(stem) == 8 and stem[4:8].isdigit():
        return stem[:4]
    return default


def filename_for(vendor: str, index: int, prefix: str | None = None) -> str:
    """Card filename for the index-th card (0-based), e.g. (sony, 0, "DSC0") ->
    DSC00001.JPG. If prefix is None, the vendor default prefix is used."""
    p = prefix or VENDORS[vendor].default_prefix
    return f"{p}{START_NUMBER + index:04d}.JPG"


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
    """Wrap an EXIF payload (``Exif\\0\\0`` + TIFF block) into a JPEG APP1 segment."""
    if len(exif_bytes) > _APP1_MAX_PAYLOAD:
        raise ValueError("EXIF block too large for one APP1 segment")
    return b"\xff\xe1" + struct.pack(">H", len(exif_bytes) + 2) + exif_bytes


def _exif_payload(jpg: bytes) -> bytes | None:
    """Return the first APP1 payload that is EXIF (``Exif\\0\\0`` + TIFF), or None."""
    if jpg[:2] != b"\xff\xd8":
        return None
    i = 2
    n = len(jpg)
    while i + 4 <= n and jpg[i] == 0xFF:
        marker = jpg[i + 1]
        if marker in (0xDA, 0xD9):
            break
        if 0xD0 <= marker <= 0xD7 or marker == 0x01:
            i += 2
            continue
        seglen = struct.unpack(">H", jpg[i + 2:i + 4])[0]
        payload = jpg[i + 4:i + 2 + seglen]
        if marker == 0xE1 and payload[:6] == b"Exif\x00\x00":
            return payload
        i += 2 + seglen
    return None


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
# In-place EXIF patching
# -----------------------------------------------------------------------------
_TYPE_SIZES = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4}


@dataclass(frozen=True)
class _Entry:
    type: int
    count: int
    pos: int  # where the value bytes live, relative to the TIFF header

    @property
    def size(self) -> int:
        return _TYPE_SIZES[self.type] * self.count


class ExifTemplate:
    """A real camera's EXIF block, parsed once and patched in place per card.

    The block is kept byte for byte: byte order, tag layout and the MakerNote
    (whose internal offsets are relative to the TIFF header, so they only stay
    valid if nothing moves). Only fixed-size values are overwritten.
    """

    def __init__(self, payload: bytes):
        if payload[:6] != b"Exif\x00\x00":
            raise ValueError("template EXIF: not an Exif APP1 payload")
        self.tiff = bytes(payload[6:])
        t = self.tiff
        if len(t) < 8 or t[:2] not in (b"II", b"MM"):
            raise ValueError("template EXIF: bad TIFF header")
        self.byte_order = t[:2]
        self._bo = "<" if t[:2] == b"II" else ">"
        if self._u16(2) != 42:
            raise ValueError("template EXIF: bad TIFF magic")

        self._seen: set[int] = set()
        self.ifds: dict[str, dict[int, _Entry]] = {}
        self.ifds["0th"], next_ifd = self._read_ifd(self._u32(4))
        for name, parent, tag in (("Exif", "0th", _T_EXIF_IFD),
                                  ("GPS", "0th", _T_GPS_IFD),
                                  ("Interop", "Exif", _T_INTEROP_IFD)):
            e = self.ifds.get(parent, {}).get(tag)
            if e is not None:
                self.ifds[name], _ = self._read_ifd(self._int_at(e))
        if next_ifd:
            self.ifds["1st"], _ = self._read_ifd(next_ifd)
        self._check()

    # --- low-level reads ---------------------------------------------------
    def _need(self, pos: int, size: int) -> None:
        if pos < 0 or pos + size > len(self.tiff):
            raise ValueError("template EXIF: offset out of range")

    def _u16(self, pos: int) -> int:
        self._need(pos, 2)
        return struct.unpack_from(self._bo + "H", self.tiff, pos)[0]

    def _u32(self, pos: int) -> int:
        self._need(pos, 4)
        return struct.unpack_from(self._bo + "I", self.tiff, pos)[0]

    def _int_at(self, e: _Entry) -> int:
        return self._u16(e.pos) if e.type == 3 else self._u32(e.pos)

    def _read_ifd(self, off: int) -> tuple[dict[int, _Entry], int]:
        if off in self._seen:
            raise ValueError("template EXIF: IFD loop")
        self._seen.add(off)
        count = self._u16(off)
        self._need(off + 2, count * 12 + 4)
        entries: dict[int, _Entry] = {}
        for k in range(count):
            at = off + 2 + 12 * k
            tag, typ = struct.unpack_from(self._bo + "HH", self.tiff, at)
            n = self._u32(at + 4)
            if typ not in _TYPE_SIZES:
                continue  # unknown type: leave it alone, never patch it
            size = _TYPE_SIZES[typ] * n
            pos = at + 8 if size <= 4 else self._u32(at + 8)
            self._need(pos, size)
            entries[tag] = _Entry(typ, n, pos)
        return entries, self._u32(off + 2 + 12 * count)

    def _ascii(self, ifd: str, tag: int) -> str:
        e = self.ifds.get(ifd, {}).get(tag)
        if e is None or e.type != 2:
            return ""
        return self.tiff[e.pos:e.pos + e.count].split(b"\x00", 1)[0].decode("latin-1").strip()

    def _check(self) -> None:
        o = self.ifds["0th"].get(_T_ORIENTATION)
        if o is None or o.type != 3:
            raise ValueError("template EXIF: no Orientation tag")
        if "Exif" not in self.ifds:
            raise ValueError("template EXIF: no Exif IFD")
        interop = self.ifds.get("Interop", {}).get(_INTEROP_INDEX)
        if interop is None or self.tiff[interop.pos:interop.pos + 3] != b"R98":
            raise ValueError("template EXIF: no R98 DCF Interop marker")
        first = self.ifds.get("1st", {})
        for tag in (_T_THUMB_OFFSET, _T_THUMB_LENGTH):
            e = first.get(tag)
            if e is None or e.type not in (3, 4):
                raise ValueError("template EXIF: no embedded thumbnail (IFD1)")
        self._need(self._int_at(first[_T_THUMB_OFFSET]), self._int_at(first[_T_THUMB_LENGTH]))
        if not self.make:
            raise ValueError("template EXIF: no Make")

    # --- public read-only views (tests / validation) -----------------------
    @property
    def make(self) -> str:
        return self._ascii("0th", _T_MAKE)

    @property
    def makernote(self) -> bytes:
        e = self.ifds["Exif"].get(_T_MAKERNOTE)
        return self.tiff[e.pos:e.pos + e.size] if e else b""

    # --- patching ----------------------------------------------------------
    def _put_int(self, buf: bytearray, ifd: str, tag: int, value: int) -> None:
        e = self.ifds.get(ifd, {}).get(tag)
        if e is None or e.count < 1 or e.type not in (3, 4):
            return
        struct.pack_into(self._bo + ("H" if e.type == 3 else "I"), buf, e.pos, value)

    def _put_ascii(self, buf: bytearray, ifd: str, tag: int, value: bytes) -> None:
        e = self.ifds.get(ifd, {}).get(tag)
        if e is None or e.type != 2 or e.count < len(value) + 1:
            return
        buf[e.pos:e.pos + e.count] = value + bytes(e.count - len(value))

    def _blank(self, buf: bytearray, ifd: str, tag: int) -> None:
        e = self.ifds.get(ifd, {}).get(tag)
        if e is not None:
            buf[e.pos:e.pos + e.size] = bytes(e.size)

    def patched(self, exif_orient: int, make_thumb) -> bytes:
        """Return the APP1 payload for one card.

        ``make_thumb(box)`` returns thumbnail JPEG bytes no larger than box px.
        """
        buf = bytearray(self.tiff)
        for ifd in ("0th", "1st"):
            self._put_int(buf, ifd, _T_ORIENTATION, exif_orient)
            self._put_int(buf, ifd, _T_YCBCR_POS, 2)          # Co-sited (cardify.sh:389)
            self._put_ascii(buf, ifd, _T_DATETIME, FIXED_DATE)
        self._put_int(buf, "0th", _T_IMAGE_W, OUT_W)
        self._put_int(buf, "0th", _T_IMAGE_H, OUT_H)
        self._put_ascii(buf, "Exif", _T_DATE_ORIGINAL, FIXED_DATE)   # cardify.sh:375-379
        self._put_ascii(buf, "Exif", _T_DATE_DIGITIZED, FIXED_DATE)
        self._put_int(buf, "Exif", _T_PIXEL_X, OUT_W)               # cardify.sh:365-368
        self._put_int(buf, "Exif", _T_PIXEL_Y, OUT_H)
        for tag in _IDENTIFYING_0TH:
            self._blank(buf, "0th", tag)
            self._blank(buf, "1st", tag)  # Sony repeats Artist/Copyright in IFD1
        for tag in _IDENTIFYING_EXIF:
            self._blank(buf, "Exif", tag)
        for tag in self.ifds.get("GPS", {}):
            if tag != _T_GPS_VERSION:
                self._blank(buf, "GPS", tag)
        self._place_thumbnail(buf, make_thumb)
        return b"Exif\x00\x00" + bytes(buf)

    def _place_thumbnail(self, buf: bytearray, make_thumb) -> None:
        first = self.ifds["1st"]
        off = self._int_at(first[_T_THUMB_OFFSET])
        slot = self._int_at(first[_T_THUMB_LENGTH])
        buf[off:off + slot] = bytes(slot)  # the template's own thumbnail never ships
        thumb = make_thumb(160)
        if len(thumb) > slot and 6 + len(buf) + len(thumb) <= _APP1_MAX_PAYLOAD:
            off = len(buf)  # append after everything else: no other offset moves
            buf += thumb
        else:
            for box in (128, 96, 64):
                if len(thumb) <= slot:
                    break
                thumb = make_thumb(box)
            if len(thumb) > slot:
                raise ValueError("thumbnail does not fit the template's EXIF block")
            buf[off:off + len(thumb)] = thumb
        self._put_int(buf, "1st", _T_THUMB_OFFSET, off)
        self._put_int(buf, "1st", _T_THUMB_LENGTH, len(thumb))


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


def _to_rgb(img: Image.Image, bg=(255, 255, 255)) -> Image.Image:
    """RGB copy of *img* with any transparency flattened onto *bg* (a bare
    convert("RGB") turns transparent pixels black)."""
    if img.mode in ("RGBA", "LA", "PA", "RGBa", "La") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        flat = Image.new("RGB", rgba.size, bg)
        flat.paste(rgba, mask=rgba.getchannel("A"))
        return flat
    return img.convert("RGB")


def _fit(img: Image.Image, w: int, h: int, bg=(255, 255, 255)) -> Image.Image:
    """Scale *img* to fit within w×h preserving aspect ratio (never stretch or
    crop) and centre it on a solid background. A design already at the target
    ratio fills the frame exactly with no bars; any other shape (square,
    portrait photo, screenshot) keeps its proportions with letterbox bars."""
    img = _to_rgb(img, bg)
    iw, ih = img.size
    if (iw, ih) == (w, h):
        return img
    scale = min(w / iw, h / ih)
    nw, nh = max(1, round(iw * scale)), max(1, round(ih * scale))
    resized = img.resize((nw, nh), Image.LANCZOS)
    if (nw, nh) == (w, h):
        return resized
    canvas = Image.new("RGB", (w, h), bg)
    canvas.paste(resized, ((w - nw) // 2, (h - nh) // 2))
    return canvas


def _encode_with_qtables(image: Image.Image, qtables) -> bytes:
    """Pillow JPEG encode reusing the template's exact q-tables (cardify.sh:333-336)."""
    buf = io.BytesIO()
    image.save(buf, "JPEG", qtables=qtables, subsampling=1, progressive=False, optimize=False)
    return buf.getvalue()


def _make_thumbnail(card: Image.Image, qtables, box: int = 160) -> bytes:
    thumb = card.copy()
    thumb.thumbnail((box, box), Image.LANCZOS)
    raw = _encode_with_qtables(thumb, qtables)
    return _rebuild_jpeg(raw, app1=None)  # strip JFIF from the embedded thumb too


def _watermark(img: Image.Image) -> Image.Image:
    """Overlay a tiled diagonal PREVIEW watermark (free tier). Uses Pillow's
    built-in font so it needs no font files (works on Vercel)."""
    base = img.convert("RGBA")
    try:
        font = ImageFont.load_default(size=46)
    except TypeError:  # older Pillow without the size argument
        font = ImageFont.load_default()
    text = "IN PRINCIPIO  ·  PREVIEW"
    box = ImageDraw.Draw(base).textbbox((0, 0), text, font=font, stroke_width=2)
    tw, th = box[2] - box[0], box[3] - box[1]
    tile = Image.new("RGBA", (tw + 24, th + 24), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((12, 12), text, font=font, fill=(255, 255, 255, 78),
                              stroke_width=2, stroke_fill=(0, 0, 0, 70))
    tile = tile.rotate(30, expand=True, resample=Image.BICUBIC)
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    step_x, step_y = tile.width + 60, tile.height + 40
    row = 0
    for y in range(-tile.height, base.height + tile.height, step_y):
        x0 = -tile.width + (step_x // 2 if row % 2 else 0)
        for x in range(x0, base.width + tile.width, step_x):
            overlay.alpha_composite(tile, (x, y))
        row += 1
    return Image.alpha_composite(base, overlay).convert("RGB")


def template_meta(template_path: str) -> tuple[list, ExifTemplate]:
    """Return (qtables, exif_template) read from a real-camera template JPEG.

    qtables is normalised to a list-of-tables (each 64 ints), the format Pillow's
    ``save(qtables=...)`` accepts most reliably across versions.

    exif_template is the template's own EXIF block, ready to be patched per card
    (see ExifTemplate). Raises ValueError if the template lacks anything a card
    needs (Orientation, R98 marker, embedded thumbnail, Make).
    """
    tpl = Image.open(template_path)
    if not tpl.quantization:
        raise ValueError("template has no quantization tables — is it a real camera JPEG?")
    qtables = [list(tpl.quantization[k]) for k in sorted(tpl.quantization)]

    with open(template_path, "rb") as fh:
        payload = _exif_payload(fh.read())
    if payload is None:
        raise ValueError("template has no EXIF — is it a real camera JPEG?")
    return qtables, ExifTemplate(payload)


def convert(image_bytes: bytes, template_path: str, orientation: str = "auto",
            watermark: bool = False) -> bytes:
    """Convert a design image into a camera-ready playback-card JPEG.

    Args:
        image_bytes: the user's design export (any size / format Pillow can open).
        template_path: a real straight-out-of-camera JPEG for this vendor.
        orientation: "auto" (from input aspect), "landscape", or "portrait".
        watermark: overlay a PREVIEW watermark (free tier).

    Returns:
        JPEG bytes: 1920x1280, baseline 4:2:2, template q-tables, DCF/EXIF set.
    """
    qtables, exif_base = template_meta(template_path)
    return convert_with(image_bytes, qtables, exif_base, orientation, watermark)


def convert_with(image_bytes: bytes, qtables: list, exif_base: ExifTemplate,
                 orientation: str = "auto", watermark: bool = False) -> bytes:
    """Like convert(), but with template metadata already read — lets a batch
    read the template once and reuse it for every card."""
    try:
        src = Image.open(io.BytesIO(image_bytes))
    except Exception:
        raise ValueError("could not read image (unsupported or corrupt file)")
    if src.width * src.height > MAX_INPUT_PIXELS:
        raise ValueError(
            f"image too large ({src.width}x{src.height}); "
            f"max {MAX_INPUT_PIXELS // 1_000_000} megapixels"
        )
    try:
        src.load()  # truncated / broken pixel data fails here, not mid-encode
    except Exception:
        raise ValueError("could not read image (unsupported or corrupt file)")
    try:
        src = ImageOps.exif_transpose(src)  # honour the source's own EXIF orientation
    except Exception:
        pass  # unreadable EXIF in the design: keep the pixels as stored

    orientation = _resolve_orientation(src, orientation)
    if orientation == "portrait":
        pre_w, pre_h, rotate, exif_orient = 1280, 1920, True, 6
    else:
        pre_w, pre_h, rotate, exif_orient = 1920, 1280, False, 1

    card = _fit(src, pre_w, pre_h)         # letterbox to the frame, never stretch
    if watermark:
        card = _watermark(card)  # before rotate so it stays aligned with the photo
    if rotate:
        card = card.transpose(Image.ROTATE_90)  # PIL ROTATE_90 == CCW (cardify.sh:335)

    raw = _encode_with_qtables(card, qtables)
    exif = exif_base.patched(exif_orient, lambda box: _make_thumbnail(card, qtables, box))
    return _rebuild_jpeg(raw, _frame_app1(exif))
