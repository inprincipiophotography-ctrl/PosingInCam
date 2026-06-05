"""Adversarial security tests for the upload/convert path.

Confirms malicious uploads are rejected safely (no crash, clean ValueError -> 400)
and that user-controlled filenames cannot escape the generated ZIP layout.
Run: python tests/test_security.py
"""

import io
import os
import sys
import struct
import zlib
import zipfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PIL import Image
from converter import encoder, pack

TPL = encoder.template_path_for("sony")
QT, EXIF_BASE = encoder.template_meta(TPL)


def _conv(b):
    return encoder.convert_with(b, QT, EXIF_BASE, "auto", False)


def _png_with_dims(w, h):
    """A structurally-valid PNG header claiming huge dimensions (decompression bomb)."""
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)  # 8-bit RGB

    def chunk(typ, data):
        return struct.pack(">I", len(data)) + typ + data + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)

    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", b"") + chunk(b"IEND", b"")


def _valid_jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (400, 300), (10, 20, 30)).save(buf, "JPEG")
    return buf.getvalue()


def test_pixel_bomb_header_rejected():
    try:
        _conv(_png_with_dims(60000, 60000))  # 3.6 Gpx claimed in the header
        raise AssertionError("expected pixel-bomb to be rejected")
    except ValueError as e:
        assert ("too large" in str(e)) or ("could not read" in str(e)), str(e)


def test_svg_with_script_rejected():
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    try:
        _conv(svg)
        raise AssertionError("expected SVG to be rejected")
    except ValueError as e:
        assert "could not read" in str(e)


def test_corrupt_bytes_rejected():
    try:
        _conv(b"\xff\xd8\xff\xe0 not really a jpeg " + b"\x00" * 50)
        raise AssertionError("expected corrupt input to be rejected")
    except ValueError as e:
        assert "could not read" in str(e)


def test_filename_cannot_escape_zip():
    evil = "../../../../etc/passwd\x00.jpg"
    z = pack.build_zip([(evil, _valid_jpeg())], "sony", "auto", False)
    names = zipfile.ZipFile(io.BytesIO(z)).namelist()
    # Output paths are server-generated; the user's filename is never used.
    assert names == ["DCIM/100MSDCF/DSC00001.JPG", "README.txt"], names
    for n in names:
        assert ".." not in n and "etc" not in n and "passwd" not in n and "\x00" not in n


def test_malicious_exif_not_propagated():
    # Upload a JPEG carrying a fake camera Make; output must use the TEMPLATE's
    # identity, never the attacker's metadata.
    import piexif
    buf = io.BytesIO()
    ex = piexif.dump({"0th": {piexif.ImageIFD.Make: b"'; DROP TABLE profiles;--"}})
    Image.new("RGB", (1500, 1000), (5, 5, 5)).save(buf, "JPEG", exif=ex)
    out = _conv(buf.getvalue())
    got = piexif.load(out)["0th"].get(piexif.ImageIFD.Make, b"")
    assert b"DROP TABLE" not in got, got


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print("ok:", fn.__name__)
    print(f"\nAll {len(fns)} security tests passed.")
