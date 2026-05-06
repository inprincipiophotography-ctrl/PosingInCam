"""Visual sanity check: rendered cards must contain non-trivial high-contrast content.

These tests catch regressions where the SVG renders blank, fonts are missing,
CSS classes don't apply, or transforms push content off-canvas. Without them
we'd silently ship blank JPEGs that pass schema/EXIF/DCF checks.

The card uses a dark theme (white-ish content on dark navy background), so
"content" pixels are bright and "background" pixels are dark.
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


def _bright_pixel_count(img: Image.Image, stride: int = 2, threshold: int = 200) -> int:
    """Count pixels brighter than threshold using an `stride`-step grid."""
    w, h = img.size
    return sum(
        1
        for x in range(0, w, stride)
        for y in range(0, h, stride)
        if sum(img.getpixel((x, y))[:3]) / 3 > threshold
    )


def test_card_jpeg_has_visible_content() -> None:
    """A blank card (all background) means the layout broke. Reject it."""
    profile = get_profile("sony-a7iv")
    pose = next(p for p in load_poses(REPO_ROOT / "poses") if p.id == "P-001")
    body = render_card(pose, profile, illustration_root=REPO_ROOT)

    img = Image.open(BytesIO(body))
    bright = _bright_pixel_count(img, stride=2)
    # Stride 2 on 1920x1280 = ~614k samples. A normal dark card with text
    # + line illustration hits at least ~2000 bright pixels.
    assert bright > 1500, f"only {bright} bright pixels — card is essentially blank"


def test_card_has_content_in_each_zone() -> None:
    """The four primary zones of the side-by-side layout must each render
    visible content. Catches regressions where one panel silently disappears
    (transform wrong, CSS class fails, content overflows off-canvas, ...).
    """
    profile = get_profile("sony-a7iv")
    pose = next(p for p in load_poses(REPO_ROOT / "poses") if p.id == "P-001")
    body = render_card(pose, profile, illustration_root=REPO_ROOT)
    img = Image.open(BytesIO(body))
    w, h = img.size

    zones = {
        "left illustration":         (0,      0,             w // 2, h),
        "right title block":         (w // 2, int(h * 0.10), w,      int(h * 0.30)),
        "right HER/HIM row":         (w // 2, int(h * 0.32), w,      int(h * 0.50)),
        "right LENS/CAMERA row":     (w // 2, int(h * 0.50), w,      int(h * 0.65)),
        "right SAY hero panel":      (w // 2, int(h * 0.65), w,      int(h * 0.85)),
    }

    for label, (x0, y0, x1, y1) in zones.items():
        crop = img.crop((x0, y0, x1, y1))
        bright = _bright_pixel_count(crop, stride=3)
        assert bright > 100, f"zone {label!r} has only {bright} bright pixels (likely empty)"


def test_thumbnail_jpeg_has_visible_content() -> None:
    """The 160x120 line-art thumbnail is what cameras show in grid view —
    if it's blank, the whole product premise breaks."""
    illustration = REPO_ROOT / "assets/illustrations/walking-hand-in-hand.svg"
    svg = render_thumbnail_svg(illustration, width=160, height=120)
    png = svg_to_png_bytes(svg, width=160, height=120)
    img = Image.open(BytesIO(png))

    # Thumbnail still uses light bg by default (better for grid-view visibility);
    # we look for dark line-art on light bg.
    w, h = img.size
    dark = sum(
        1
        for x in range(0, w, 2)
        for y in range(0, h, 2)
        if sum(img.getpixel((x, y))[:3]) / 3 < 200
    )
    assert dark > 80, f"thumbnail is essentially blank ({dark} dark pixels)"
