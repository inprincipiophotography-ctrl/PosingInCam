"""End-to-end render pipeline: Pose + profile -> JPEG bytes with EXIF + thumbnail."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import piexif
from PIL import Image

from posingincam.cameras.registry import get_profile
from posingincam.output.writer import render_card, render_cards
from posingincam.pose.loader import load_poses

REPO_ROOT = Path(__file__).resolve().parents[1]


def test_render_p001_for_sony_a7iv() -> None:
    profile = get_profile("sony-a7iv")
    poses = load_poses(REPO_ROOT / "poses")
    pose = next(p for p in poses if p.id == "P-001")

    body = render_card(pose, profile, illustration_root=REPO_ROOT)

    img = Image.open(BytesIO(body))
    assert img.format == "JPEG"
    assert img.size == (profile.image.width, profile.image.height)

    # File is small but not absurdly so.
    assert 50_000 < len(body) < 500_000

    # EXIF round-trip.
    exif = piexif.load(body)
    assert exif["0th"][piexif.ImageIFD.Make] == b"SONY"
    assert exif["0th"][piexif.ImageIFD.Model] == b"ILCE-7M4"
    assert exif["0th"][piexif.ImageIFD.ImageDescription] == b"posingincam:P-001:v1"

    # Thumbnail is JPEG, 160x120.
    thumb = exif.get("thumbnail")
    assert thumb is not None
    timg = Image.open(BytesIO(thumb))
    assert timg.format == "JPEG"
    assert timg.size == (160, 120)


def test_render_cards_assigns_dcf_filenames() -> None:
    profile = get_profile("sony-a7iv")
    poses = load_poses(REPO_ROOT / "poses")
    cards = render_cards(poses, profile, illustration_root=REPO_ROOT)

    assert len(cards) == len(poses)
    assert cards[0].file_name == "DSC00001.JPG"
    assert cards[0].relative_path == Path("DCIM/199MSDCF/DSC00001.JPG")


def test_render_is_deterministic() -> None:
    profile = get_profile("sony-a7iv")
    poses = load_poses(REPO_ROOT / "poses")
    pose = next(p for p in poses if p.id == "P-001")

    a = render_card(pose, profile, illustration_root=REPO_ROOT)
    b = render_card(pose, profile, illustration_root=REPO_ROOT)
    assert a == b
