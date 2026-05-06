"""Generate the 160x120 line-art-only JPEG thumbnail for EXIF embedding."""

from __future__ import annotations

from pathlib import Path

from posingincam.render.jpeg import png_to_jpeg_bytes
from posingincam.render.layout import render_thumbnail_svg
from posingincam.render.rasterize import svg_to_png_bytes

THUMBNAIL_WIDTH = 160
THUMBNAIL_HEIGHT = 120


def make_thumbnail_jpeg(
    illustration_path: Path,
    width: int = THUMBNAIL_WIDTH,
    height: int = THUMBNAIL_HEIGHT,
    quality: int = 85,
) -> bytes:
    """Return JPEG bytes of the bare illustration sized for the camera grid view."""
    svg = render_thumbnail_svg(illustration_path, width=width, height=height)
    png = svg_to_png_bytes(svg, width=width, height=height)
    return png_to_jpeg_bytes(png, quality=quality)
