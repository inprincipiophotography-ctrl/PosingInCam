"""Build the library against a temp dir and assert DCF compliance."""

from __future__ import annotations

from pathlib import Path

from posingincam.cameras.registry import get_profile
from posingincam.output.writer import render_cards, write_to_disk
from posingincam.pose.loader import load_poses
from tests.dcf_validator import validate_tree

REPO_ROOT = Path(__file__).resolve().parents[1]


def test_built_tree_is_dcf_compliant(tmp_path: Path) -> None:
    profile = get_profile("sony-a7iv")
    poses = load_poses(REPO_ROOT / "poses")
    cards = render_cards(poses, profile, illustration_root=REPO_ROOT)
    write_to_disk(cards, tmp_path)

    violations = validate_tree(tmp_path)
    assert violations == [], "\n".join(violations)
