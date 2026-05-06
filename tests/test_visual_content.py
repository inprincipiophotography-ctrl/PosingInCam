"""Visual sanity check: rendered cards must contain non-trivial dark content.

These tests catch regressions where the SVG renders blank, fonts are missing,
CSS classes don't apply, or transforms push content off-canvas. Without them
we'd silently ship all-white JPEGs that pass schema/EXIF/DCF checks.
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image

from posingincam.cameras.registry import get_profile
from posingincam.output.writer import render_card
from posingincam.pose.loader import load_poses
from posingincam.render.layout import render_thumbnail_svg
from posingincam.render.rasterize import svg_to_png_bytes

REPO_ROOT = Path(__file__).resolve().parents[1]


def _dark_pixel_count(img: Image.Image, stride: int = 4, threshold: int = 200) -> int:
    """Count pixels darker than threshold using an `stride`-step grid."""
    w, h = img.size
    return sum(
        1
        for x in range(0, w, stride)
        for y in range(0, h, stride)
        if sum(img.getpixel((x, y))[:3]) / 3 < threshold
    )


def test_card_jpeg_has_visible_content() -> None:
    """A blank JPEG (all white) means the layout broke. Reject it."""
    profile = get_profile("sony-a7iv")
    pose = next(p for p in load_poses(REPO_ROOT / "poses") if p.id == "P-001")
    body = render_card(pose, profile, illustration_root=REPO_ROOT)

    img = Image.open(BytesIO(body))
    dark = _dark_pixel_count(img, stride=8)
    # At stride 8 on a 3840x2560 card, we sample ~150_000 points. A normal
    # card (text + line illustration) hits at least ~2000 of them.
    assert dark > 1000, f"only {dark} dark pixels — card is essentially blank"


def test_card_has_content_in_each_zone() -> None:
    """Title/illustration/right column/cue zones must each have content.

    Catches the failure mode where one section silently disappears
    (e.g. a transform is wrong, or one section's CSS class breaks).
    """
    profile = get_profile("sony-a7iv")
    pose = next(p for p in load_poses(REPO_ROOT / "poses") if p.id == "P-001")
    body = render_card(pose, profile, illustration_root=REPO_ROOT)
    img = Image.open(BytesIO(body))
    w, h = img.size

    zones = {
        "header (title + id)":    (0,         0,        w,         int(h * 0.10)),
        "illustration (left)":    (0,         int(h * 0.10), int(w * 0.45), int(h * 0.65)),
        "right column":           (int(w * 0.42), int(h * 0.10), w,         int(h * 0.65)),
        "cue (bottom band)":      (0,         int(h * 0.78), w,         int(h * 0.95)),
    }

    for label, (x0, y0, x1, y1) in zones.items():
        crop = img.crop((x0, y0, x1, y1))
        dark = _dark_pixel_count(crop, stride=6)
        assert dark > 50, f"zone {label!r} has only {dark} dark pixels (likely empty)"


def test_thumbnail_jpeg_has_visible_content() -> None:
    """The 160x120 line-art thumbnail is what cameras show in grid view —
    if it's blank, the whole product premise breaks."""
    illustration = REPO_ROOT / "assets/illustrations/walking-hand-in-hand.svg"
    svg = render_thumbnail_svg(illustration, width=160, height=120)
    png = svg_to_png_bytes(svg, width=160, height=120)
    img = Image.open(BytesIO(png))

    dark = _dark_pixel_count(img, stride=2, threshold=200)
    # ~4800 sample points; even a sparse line drawing hits ~150 of them.
    assert dark > 80, f"thumbnail is essentially blank ({dark} dark pixels)"
