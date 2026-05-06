"""Bind a Pose into an SVG layout template."""

from __future__ import annotations

from pathlib import Path
from xml.etree import ElementTree as ET

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from posingincam.cameras.profile import CameraProfile
from posingincam.pose.schema import Pose

TEMPLATES_DIR = Path(__file__).parent / "templates"

# Reference scale: 4000px wide template; we scale all coordinates linearly to the camera's width.
REFERENCE_WIDTH = 4000

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)


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


def _parse_illustration(svg_text: str) -> tuple[str, str]:
    """Return (inner_svg_markup, viewBox) from an illustration SVG file.

    Uses a real XML parser so nested <svg> elements, single-quoted attrs,
    CDATA sections, and namespace prefixes don't trip us up.
    """
    try:
        root = ET.fromstring(svg_text)
    except ET.ParseError as exc:
        raise ValueError(f"illustration is not valid XML: {exc}") from exc

    tag = root.tag
    if not (tag == "svg" or tag.endswith("}svg")):
        raise ValueError(f"illustration root is not <svg> (got {tag!r})")

    # Resolve viewBox from attribute, falling back to width/height when absent.
    viewbox = root.attrib.get("viewBox")
    if not viewbox:
        width_attr = root.attrib.get("width", "100")
        height_attr = root.attrib.get("height", "100")
        # Strip units (e.g. "100px") for the viewBox fallback.
        w = "".join(ch for ch in width_attr if ch in "0123456789.") or "100"
        h = "".join(ch for ch in height_attr if ch in "0123456789.") or "100"
        viewbox = f"0 0 {w} {h}"

    # Serialize children to string so they can be inlined into the card template.
    inner_parts = []
    if root.text:
        inner_parts.append(root.text)
    for child in root:
        inner_parts.append(ET.tostring(child, encoding="unicode"))
    inner = "".join(inner_parts).strip()
    return inner, viewbox


def render_card_svg(
    pose: Pose,
    profile: CameraProfile,
    illustration_path: Path,
    template: str = "card_default.svg.j2",
) -> str:
    """Render a pose into a card SVG sized for the camera profile."""
    if not illustration_path.is_file():
        raise FileNotFoundError(f"illustration not found: {illustration_path}")
    illustration_inner, illustration_viewbox = _parse_illustration(
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
    illustration_inner, viewbox = _parse_illustration(
        illustration_path.read_text(encoding="utf-8")
    )
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<svg xmlns="{SVG_NS}" '
        f'width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        f'<rect width="100%" height="100%" fill="#ffffff"/>'
        f'<svg width="{width}" height="{height}" viewBox="{viewbox}" '
        f'preserveAspectRatio="xMidYMid meet">{illustration_inner}</svg>'
        f"</svg>"
    )
