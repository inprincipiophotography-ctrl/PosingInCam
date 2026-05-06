"""Write rendered cards to a DCF-compliant tree on disk.

The end-to-end render orchestration lives here so the CLI commands stay
thin glue. Rendering is pure (returns bytes); writer is the only side-effect.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from posingincam.cameras.profile import CameraProfile
from posingincam.pose.schema import Pose
from posingincam.render.exif import build_exif_bytes, embed_exif
from posingincam.render.jpeg import png_to_jpeg_bytes
from posingincam.render.layout import render_card_svg
from posingincam.render.rasterize import svg_to_png_bytes
from posingincam.render.thumbnail import make_thumbnail_jpeg


@dataclass(frozen=True)
class RenderedCard:
    pose_id: str
    file_name: str
    relative_path: Path
    bytes: bytes


def render_card(pose: Pose, profile: CameraProfile, illustration_root: Path) -> bytes:
    """Render one pose to JPEG bytes, with embedded EXIF + thumbnail."""
    illustration_path = (illustration_root / pose.illustration).resolve()

    svg = render_card_svg(pose, profile, illustration_path)
    png = svg_to_png_bytes(svg, width=profile.image.width, height=profile.image.height)
    jpeg = png_to_jpeg_bytes(png, quality=profile.image.jpeg_quality)

    thumb = make_thumbnail_jpeg(illustration_path, quality=profile.image.jpeg_quality)
    exif = build_exif_bytes(
        profile,
        pose,
        thumb,
        image_width=profile.image.width,
        image_height=profile.image.height,
    )
    return embed_exif(jpeg, exif)


def render_cards(
    poses: list[Pose],
    profile: CameraProfile,
    illustration_root: Path,
) -> list[RenderedCard]:
    """Render a sorted list of poses for one camera, assigning DCF filenames."""
    rendered: list[RenderedCard] = []
    folder = profile.dcf.folder_name
    for offset, pose in enumerate(poses):
        index = profile.dcf.starting_index + offset
        file_name = profile.dcf.file_name(index)
        body = render_card(pose, profile, illustration_root)
        rendered.append(
            RenderedCard(
                pose_id=pose.id,
                file_name=file_name,
                relative_path=Path("DCIM") / folder / file_name,
                bytes=body,
            )
        )
    return rendered


def write_to_disk(
    cards: list[RenderedCard],
    out_root: Path,
    overwrite: bool = False,
) -> list[Path]:
    """Write rendered cards under out_root, returning the list of paths written."""
    out_root.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for card in cards:
        target = out_root / card.relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and not overwrite:
            raise FileExistsError(target)
        target.write_bytes(card.bytes)
        written.append(target)
    return written
