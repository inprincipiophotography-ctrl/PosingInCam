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
import PIL.JpegImagePlugin as JpegPlugin
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


def _blank(value):
    """True if an EXIF value carries no information (empty / all NULs / spaces)."""
    if isinstance(value, bytes):
        return not value.strip(b"\x00 ")
    return not value


def test_identifying_tags_stripped_for_every_vendor():
    # Real templates carry the owner's body/lens serials, name and copyright;
    # none of that may reach a customer's card. The tags may stay (blanked in
    # place, so nothing in the EXIF block moves) but must hold no data, and the
    # values must not appear anywhere in the EXIF outside the binary MakerNote
    # (kept verbatim, as in the hardware-tested cardify.sh output).
    src = _jpg(Image.new("RGB", (300, 200), (90, 160, 60)))
    seen_in_template = False
    for vendor, v in encoder.VENDORS.items():
        tpl = encoder.template_path_for(vendor)
        tex = piexif.load(tpl)
        secrets = [tex["0th"].get(t) for t in encoder._IDENTIFYING_0TH]
        secrets += [tex["Exif"].get(t) for t in encoder._IDENTIFYING_EXIF]
        secrets = [x.strip(b"\x00 ") for x in secrets if isinstance(x, bytes)]
        secrets = [x for x in secrets if len(x) >= 4 and x.strip(b"0")]
        seen_in_template |= bool(secrets)

        out = encoder.convert(src, tpl)
        ex = piexif.load(out)
        for t in encoder._IDENTIFYING_0TH:
            assert _blank(ex["0th"].get(t, b"")), f"{vendor}: 0th tag {t:#06x} leaked into output"
        for t in encoder._IDENTIFYING_EXIF:
            assert _blank(ex["Exif"].get(t, b"")), f"{vendor}: Exif tag {t:#06x} leaked into output"
        payload = encoder._exif_payload(out)
        mn = encoder.ExifTemplate(payload).makernote
        outside = payload.replace(mn, b"") if mn else payload
        for secret in secrets:
            assert secret not in outside, f"{vendor}: {secret!r} still in the EXIF block"
        assert ex["0th"][piexif.ImageIFD.Make].decode() == v.make, f"{vendor}: Make lost"
        assert ex["0th"][piexif.ImageIFD.Model].decode().startswith(v.model_prefix), f"{vendor}: Model lost"
        for value in ex["GPS"].values():
            assert value in ((2, 3, 0, 0), (2, 2, 0, 0)) or _blank(value) or not any(
                (value if isinstance(value, tuple) else (value,))), f"{vendor}: GPS data leaked: {value!r}"
    # guard against a vacuous pass if the bundled templates are ever swapped for clean ones
    assert seen_in_template, "no template carries an identifying tag; test no longer exercises the strip"


def test_every_vendor_keeps_the_template_exif_block():
    # The hardware-tested cardify.sh output keeps the template's byte order and
    # MakerNotes; the web output must too, and patch only the per-card values.
    design = _jpg(Image.new("RGB", (900, 1350), (30, 60, 90)))
    for vendor in encoder.VENDORS:
        tpl_path = encoder.template_path_for(vendor)
        qt, et = encoder.template_meta(tpl_path)
        out = encoder.convert_with(design, qt, et)
        _spec_checks(out, 6)
        out_et = encoder.ExifTemplate(encoder._exif_payload(out))
        assert out_et.byte_order == et.byte_order, f"{vendor}: EXIF byte order changed"
        assert out_et.makernote == et.makernote, f"{vendor}: MakerNote changed"
        assert len(out_et.tiff) == len(et.tiff), f"{vendor}: EXIF block grew for a simple card"
        im = Image.open(io.BytesIO(out))
        tpl = Image.open(tpl_path)
        assert [list(im.quantization[k]) for k in sorted(im.quantization)] == \
               [list(tpl.quantization[k]) for k in sorted(tpl.quantization)], f"{vendor}: q-tables differ"
        assert JpegPlugin.get_sampling(im) == 1, f"{vendor}: not 4:2:2"
        ex = piexif.load(out)
        assert ex["0th"][piexif.ImageIFD.DateTime] == encoder.FIXED_DATE
        assert ex["Exif"][piexif.ExifIFD.DateTimeOriginal] == encoder.FIXED_DATE
        assert ex["Exif"][piexif.ExifIFD.DateTimeDigitized] == encoder.FIXED_DATE
        assert ex["Exif"][piexif.ExifIFD.PixelXDimension] == encoder.OUT_W
        assert ex["Exif"][piexif.ExifIFD.PixelYDimension] == encoder.OUT_H
        assert ex["0th"][piexif.ImageIFD.YCbCrPositioning] == 2
        im.load()


def test_busy_design_thumbnail_always_fits():
    # A noisy design compresses badly; its thumbnail may not fit the template's
    # old thumbnail slot. It must still produce a valid card for every vendor.
    import random
    rnd = random.Random(7)
    noise = Image.frombytes("RGB", (480, 320), bytes(rnd.getrandbits(8) for _ in range(480 * 320 * 3)))
    for vendor in encoder.VENDORS:
        out = encoder.convert(_jpg(noise), encoder.template_path_for(vendor))
        _spec_checks(out, 1)


def _libjpeg_tables():
    """The q-tables a generic encoder (libjpeg / Pillow / ImageMagick) writes at
    every quality setting — the fingerprint Sony A7 III rejects."""
    tables = []
    for q in range(1, 101):
        buf = io.BytesIO()
        Image.new("RGB", (16, 16)).save(buf, "JPEG", quality=q)
        im = Image.open(buf)
        tables.append([list(im.quantization[k]) for k in sorted(im.quantization)])
    return tables


def test_bundled_templates_are_straight_out_of_camera():
    # A template must be an untouched camera JPEG: older bodies validate the
    # q-tables (docs/SONY_Q_TABLE_DISCOVERY.md), and the tested pipeline carried
    # the camera's MakerNotes.
    generic = _libjpeg_tables()
    for vendor, v in encoder.VENDORS.items():
        path = encoder.template_path_for(vendor)
        tpl = Image.open(path)
        qt = [list(tpl.quantization[k]) for k in sorted(tpl.quantization)]
        _qt, et = encoder.template_meta(path)
        desc = piexif.load(path)["0th"].get(piexif.ImageIFD.ImageDescription, b"")
        problems = []
        if qt in generic:
            problems.append("generic libjpeg q-tables (re-encoded, not a camera file)")
        if not et.makernote:
            problems.append("no MakerNote")
        if b"posingincam" in desc:
            problems.append("it is a PosingInCam output, not a camera file")
        if et.make != v.make:
            problems.append(f"Make is {et.make!r}, want {v.make!r}")
        assert not problems, (
            f"{vendor} template {os.path.basename(path)} is not straight out of camera: "
            + "; ".join(problems)
            + f". Copy one unedited JPEG off the camera's card into converter/templates/{vendor}/.")


def test_transparent_png_flattens_to_white():
    img = Image.new("RGBA", (1500, 1000), (0, 0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    out = _conv(buf.getvalue())
    px = Image.open(io.BytesIO(out)).convert("RGB").getpixel((encoder.OUT_W // 2, encoder.OUT_H // 2))
    assert min(px) > 230, f"transparent area should be white, got {px}"


def test_truncated_jpeg_raises_valueerror():
    data = _jpg(Image.new("RGB", (800, 600), (10, 200, 10)))
    try:
        _conv(data[: len(data) // 2])
        raise AssertionError("expected ValueError for truncated input")
    except ValueError as e:
        assert "could not read" in str(e)


def test_zip_cards_carry_the_card_date():
    import zipfile
    from converter import pack
    z = zipfile.ZipFile(io.BytesIO(pack.build_zip([("a.png", _jpg(Image.new("RGB", (300, 200))))], "canon")))
    cards = [i for i in z.infolist() if i.filename.startswith("DCIM/")]
    assert cards and all(i.date_time == (2024, 1, 1, 12, 0, 0) for i in cards)
    assert encoder.FIXED_DATE == b"2024:01:01 12:00:00"  # keep both in step


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print("ok:", fn.__name__)
    print(f"\nAll {len(fns)} tests passed.")
