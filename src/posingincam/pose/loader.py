"""Discovery and loading of pose YAML files."""

from __future__ import annotations

from pathlib import Path

from pydantic import ValidationError
from ruamel.yaml import YAML

from posingincam.pose.schema import Pose

_yaml = YAML(typ="safe")


class PoseLoadError(Exception):
    """Raised when a pose file fails to load or validate."""

    def __init__(self, path: Path, message: str) -> None:
        super().__init__(f"{path}: {message}")
        self.path = path
        self.message = message


def load_pose(path: Path) -> Pose:
    """Load a single pose YAML file into a validated Pose model."""
    if not path.is_file():
        raise PoseLoadError(path, "file does not exist")

    with path.open("r", encoding="utf-8") as fp:
        raw = _yaml.load(fp)

    if not isinstance(raw, dict):
        raise PoseLoadError(path, "top-level YAML must be a mapping")

    try:
        pose = Pose(**raw)
    except ValidationError as exc:
        raise PoseLoadError(path, str(exc)) from exc

    pose.source_path = path
    return pose


def find_pose_files(root: Path) -> list[Path]:
    """Return all pose YAML files under root, excluding _template and _packs."""
    if root.is_file():
        return [root]
    if not root.is_dir():
        raise PoseLoadError(root, "not a file or directory")

    files: list[Path] = []
    for path in sorted(root.rglob("*.yaml")):
        rel_parts = path.relative_to(root).parts
        if rel_parts and rel_parts[0].startswith("_"):
            continue
        files.append(path)
    return files


def load_poses(root: Path) -> list[Pose]:
    """Load and validate every pose YAML found under root, sorted by id."""
    poses = [load_pose(p) for p in find_pose_files(root)]
    poses.sort(key=lambda p: p.numeric_id())

    seen: dict[str, Path] = {}
    for pose in poses:
        if pose.id in seen and pose.source_path is not None:
            raise PoseLoadError(
                pose.source_path,
                f"duplicate pose id {pose.id} (also in {seen[pose.id]})",
            )
        if pose.source_path is not None:
            seen[pose.id] = pose.source_path
    return poses
