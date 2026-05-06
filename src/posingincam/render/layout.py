"""Bind a Pose into an SVG layout template."""

from __future__ import annotations

import re
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from posingincam.cameras.profile import CameraProfile
from posingincam.pose.schema import Pose

TEMPLATES_DIR = Path(__file__).parent / "templates"

# Reference scale: 4000px wide template; we scale all coordinates linearly to the camera's width.
REFERENCE_WIDTH = 4000


def _make_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        undefined=StrictUndefined,
        autoescape=select_autoescape(default=False),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def _wrap_cue(verbal_cue: str, max_chars: int = 42) -> list[str]:
    """Soft-wrap the verbal cue, preserving explicit newlines from the YAML."""
    out: list[str] = []
    for raw_line in verbal_cue.strip().splitlines():
        line = raw_line.strip()
        if not line:
            continue
        words = line.split(" ")
        current = ""
        for word in words:
            if not current:
                current = word
            elif len(current) + 1 + len(word) <= max_chars:
                current += " " + word
            else:
                out.append(current)
                current = word
        if current:
            out.append(current)
    return out


def _strip_xml_decl_and_root(svg_text: str) -> tuple[str, str]:
    """Strip <?xml ?> and the outer <svg> tag, returning (inner, viewBox).

    The illustration SVG is composed inside a wrapping <svg> in the template,
    so we want only its body and its viewBox.
    """
    text = svg_text.strip()
    text = re.sub(r"<\?xml[^?]*\?>", "", text)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL).strip()
    # Find the root <svg> tag (allow attributes that may contain quoted '>').
    root_match = re.search(r"<svg\b([^>]*)>", text, flags=re.IGNORECASE)
    if not root_match:
        raise ValueError("illustration is not a valid SVG (no <svg> root)")
    attrs = root_match.group(1)
    viewbox_match = re.search(r'viewBox\s*=\s*"([^"]+)"', attrs, flags=re.IGNORECASE)
    if viewbox_match:
        viewbox = viewbox_match.group(1)
    else:
        # Fall back to width/height if the SVG didn't declare viewBox.
        w = re.search(r'\bwidth\s*=\s*"([\d.]+)', attrs)
        h = re.search(r'\bheight\s*=\s*"([\d.]+)', attrs)
        viewbox = f"0 0 {w.group(1) if w else 100} {h.group(1) if h else 100}"

    inner = text[root_match.end() :]
    inner = re.sub(r"</svg>\s*$", "", inner, flags=re.IGNORECASE)
    return inner.strip(), viewbox


def render_card_svg(
    pose: Pose,
    profile: CameraProfile,
    illustration_path: Path,
    template: str = "card_default.svg.j2",
) -> str:
    """Render a pose into a card SVG sized for the camera profile."""
    if not illustration_path.is_file():
        raise FileNotFoundError(f"illustration not found: {illustration_path}")
    illustration_inner, illustration_viewbox = _strip_xml_decl_and_root(
        illustration_path.read_text(encoding="utf-8")
    )

    width = profile.image.width
    height = profile.image.height
    scale = width / REFERENCE_WIDTH

    env = _make_env()
    tpl = env.get_template(template)
    return tpl.render(
        pose=pose,
        width=width,
        height=height,
        s=lambda x: round(x * scale, 2),
        cue_lines=_wrap_cue(pose.verbal_cue),
        illustration_svg=illustration_inner,
        illustration_viewbox=illustration_viewbox,
    )


def render_thumbnail_svg(
    illustration_path: Path,
    width: int = 160,
    height: int = 120,
) -> str:
    """Wrap the bare illustration into an SVG sized for the EXIF thumbnail.

    No text, no header — just the line drawing centered on white.
    """
    illustration_inner, viewbox = _strip_xml_decl_and_root(
        illustration_path.read_text(encoding="utf-8")
    )
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        f'<rect width="100%" height="100%" fill="#ffffff"/>'
        f'<svg width="{width}" height="{height}" viewBox="{viewbox}" '
        f'preserveAspectRatio="xMidYMid meet">{illustration_inner}</svg>'
        f"</svg>"
    )
