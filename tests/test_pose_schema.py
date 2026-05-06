"""Pose schema validation."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from posingincam.pose.schema import Pose

VALID_PAYLOAD = {
    "id": "P-001",
    "slug": "walking-hand-in-hand",
    "title": "Walking Hand in Hand",
    "pack": "essential",
    "illustration": "assets/illustrations/walking-hand-in-hand.svg",
    "positioning": {
        "her": ["Step in time with him.", "Soft chin."],
        "him": ["Lead by half a pace.", "Eyes ahead."],
    },
    "camera_notes": {
        "lens": "35mm or 50mm prime",
        "aperture": "f/2.0",
        "angle": "Slightly below eye level.",
        "distance": "10-15 ft.",
    },
    "verbal_cue": '"Walk toward me. Eyes on each other on three."',
}


def test_valid_pose_loads() -> None:
    p = Pose(**VALID_PAYLOAD)
    assert p.id == "P-001"
    assert p.numeric_id() == 1
    assert p.difficulty == 1
    assert p.tags == []
    assert p.version == 1


@pytest.mark.parametrize("bad_id", ["P-1", "P001", "P-1234", "X-001", "p-001"])
def test_invalid_id_rejected(bad_id: str) -> None:
    payload = {**VALID_PAYLOAD, "id": bad_id}
    with pytest.raises(ValidationError):
        Pose(**payload)


@pytest.mark.parametrize("bad_slug", ["Walking_Hand", "walking--hand", "Walking-Hand", " "])
def test_invalid_slug_rejected(bad_slug: str) -> None:
    payload = {**VALID_PAYLOAD, "slug": bad_slug}
    with pytest.raises(ValidationError):
        Pose(**payload)


def test_verbal_cue_length_capped() -> None:
    payload = {**VALID_PAYLOAD, "verbal_cue": "x" * 241}
    with pytest.raises(ValidationError):
        Pose(**payload)


def test_positioning_requires_at_least_one_bullet() -> None:
    payload = {**VALID_PAYLOAD, "positioning": {"her": [], "him": ["one"]}}
    with pytest.raises(ValidationError):
        Pose(**payload)


def test_difficulty_in_range() -> None:
    payload = {**VALID_PAYLOAD, "difficulty": 4}
    with pytest.raises(ValidationError):
        Pose(**payload)


def test_unknown_field_rejected() -> None:
    payload = {**VALID_PAYLOAD, "mood": "intimate"}
    with pytest.raises(ValidationError):
        Pose(**payload)
