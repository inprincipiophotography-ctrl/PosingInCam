"""Discover camera profiles bundled with the package."""

from __future__ import annotations

from functools import cache
from pathlib import Path

from posingincam.cameras.profile import CameraProfile, load_profile

PROFILES_DIR = Path(__file__).parent / "profiles"


class CameraNotFoundError(LookupError):
    """Raised when a camera id isn't in the registry."""


@cache
def _all_profiles() -> dict[str, CameraProfile]:
    profiles: dict[str, CameraProfile] = {}
    for path in sorted(PROFILES_DIR.glob("*.yaml")):
        if path.stem.startswith("_"):
            continue
        profile = load_profile(path)
        profiles[profile.id] = profile
    return profiles


def list_profiles() -> list[CameraProfile]:
    return sorted(_all_profiles().values(), key=lambda p: p.id)


def get_profile(camera_id: str) -> CameraProfile:
    profiles = _all_profiles()
    if camera_id not in profiles:
        available = ", ".join(profiles) or "(none)"
        raise CameraNotFoundError(
            f"unknown camera id {camera_id!r}; available: {available}"
        )
    return profiles[camera_id]
