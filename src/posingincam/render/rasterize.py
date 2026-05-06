"""Rasterize SVG to PNG bytes via cairosvg."""

from __future__ import annotations

from typing import cast

import cairosvg


def svg_to_png_bytes(svg: str, width: int, height: int) -> bytes:
    """Render an SVG string to PNG bytes at the given pixel dimensions."""
    return cast(
        bytes,
        cairosvg.svg2png(
            bytestring=svg.encode("utf-8"),
            output_width=width,
            output_height=height,
        ),
    )
