"""Golden-property tests for converter/encoder.py.

Run directly (`python tests/test_encoder.py`) or via pytest. Asserts the output
JPEG matches the camera-card spec AND that arbitrary-aspect inputs are
letterboxed (not stretched) and source EXIF orientation is honoured.
"""

import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PIL import Image
import piexif

from converter import encoder

TPL = encoder.template_path_for("sony")
QT, EXIF_BASE = encoder.template_meta(TPL)


def _conv(img_bytes, orientation="auto", watermark=False):
    return encoder.convert_with(img_bytes, QT, EXIF_BASE, orientation, watermark)


def _jpg(img):
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    return buf.getvalue()


def _spec_checks(out, expect_orient):
    im = Image.open(io.BytesIO(out))
    assert im.size == (encoder.OUT_W, encoder.OUT_H), f"size {im.size}"          # always 1920x1280 on disk
    assert encoder._sof_marker(out) == 0xC0, "must be baseline (SOF0)"
    assert not encoder._has_app0(out), "must have no APP0/JFIF"
    ex = piexif.load(out)
    assert ex["0th"][piexif.ImageIFD.Orientation] == expect_orient
    assert ex["Interop"][1] == b"R98", "DCF Interop marker"
    assert ex["thumbnail"], "embedded thumbnail present"
    th = Image.open(io.BytesIO(ex["thumbnail"]))
    th.load()  # decodable JPEG
    assert max(th.size) <= 160, f"thumbnail too big: {th.size}"


def test_landscape_3x2_fills_frame():
    out = _conv(_jpg(Image.new("RGB", (1500, 1000), (200, 30, 30))))
    _spec_checks(out, 1)


def test_square_is_letterboxed_not_stretched():
    # red square -> centred with white bars; the square must stay square.
    out = _conv(_jpg(Image.new("RGB", (1000, 1000), (220, 20, 20))))
    _spec_checks(out, 1)
    im = Image.open(io.BytesIO(out)).convert("RGB")
    left = im.getpixel((8, encoder.OUT_H // 2))      # bar region
    centre = im.getpixel((encoder.OUT_W // 2, encoder.OUT_H // 2))
    assert min(left) > 230, f"left bar should be ~white, got {left}"
    assert centre[0] > 150 and centre[1] < 90 and centre[2] < 90, f"centre should be red, got {centre}"


def test_portrait_gets_orientation_6():
    out = _conv(_jpg(Image.new("RGB", (800, 1200), (20, 120, 220))), orientation="auto")
    _spec_checks(out, 6)  # stored 1920x1280 + EXIF Orientation=6


def test_source_exif_orientation_is_honoured():
    # 100x200 pixels but EXIF says orientation 6 -> displays as 200x100 (landscape).
    im = Image.new("RGB", (100, 200), (0, 128, 255))
    data = _jpg_with_exif(im, orientation=6)
    out = _conv(data, orientation="auto")
    # exif_transpose makes it landscape -> output orientation must be 1, not 6.
    _spec_checks(out, 1)


def _jpg_with_exif(img, orientation):
    buf = io.BytesIO()
    exif = piexif.dump({"0th": {piexif.ImageIFD.Orientation: orientation}})
    img.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


def test_pixel_cap_rejects_bomb():
    saved = encoder.MAX_INPUT_PIXELS
    encoder.MAX_INPUT_PIXELS = 1000
    try:
        _conv(_jpg(Image.new("RGB", (100, 100), (0, 0, 0))))
        raise AssertionError("expected ValueError for oversized image")
    except ValueError as e:
        assert "too large" in str(e)
    finally:
        encoder.MAX_INPUT_PIXELS = saved


def test_corrupt_input_raises_valueerror():
    try:
        _conv(b"definitely not an image")
        raise AssertionError("expected ValueError for corrupt input")
    except ValueError as e:
        assert "could not read" in str(e)


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print("ok:", fn.__name__)
    print(f"\nAll {len(fns)} tests passed.")
