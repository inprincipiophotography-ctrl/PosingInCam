"""Camera profile schema, registry, DCF naming."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from posingincam.cameras.profile import DCFConfig
from posingincam.cameras.registry import CameraNotFoundError, get_profile, list_profiles


def test_dcf_folder_name() -> None:
    cfg = DCFConfig(folder_number=199, folder_tag="MSDCF", file_prefix="DSC0")
    assert cfg.folder_name == "199MSDCF"


def test_dcf_file_name_pads_to_four_digits() -> None:
    cfg = DCFConfig(folder_number=100, folder_tag="CANON", file_prefix="IMG_")
    assert cfg.file_name(1) == "IMG_0001.JPG"
    assert cfg.file_name(42) == "IMG_0042.JPG"
    assert cfg.file_name(9999) == "IMG_9999.JPG"


@pytest.mark.parametrize("idx", [0, -1, 10000, 100000])
def test_dcf_file_name_rejects_out_of_range(idx: int) -> None:
    cfg = DCFConfig(folder_number=199, folder_tag="MSDCF", file_prefix="DSC0")
    with pytest.raises(ValueError, match="DCF file index"):
        cfg.file_name(idx)


@pytest.mark.parametrize("bad", ["msdcf", "MSDCFX", "MSD F", "MS-DC"])
def test_dcf_folder_tag_rejects_invalid(bad: str) -> None:
    with pytest.raises(ValidationError):
        DCFConfig(folder_number=199, folder_tag=bad, file_prefix="DSC0")


@pytest.mark.parametrize("bad", ["dsc0", "DSC", "DSC0X", "DS 0"])
def test_dcf_file_prefix_rejects_invalid(bad: str) -> None:
    with pytest.raises(ValidationError):
        DCFConfig(folder_number=199, folder_tag="MSDCF", file_prefix=bad)


def test_registry_finds_bundled_profiles() -> None:
    profiles = list_profiles()
    ids = {p.id for p in profiles}
    assert "sony-a7iv" in ids
    assert "generic-3-2" in ids


def test_registry_raises_on_unknown_camera() -> None:
    with pytest.raises(CameraNotFoundError):
        get_profile("nope-not-a-camera")


def test_sony_a7iv_profile_values() -> None:
    p = get_profile("sony-a7iv")
    assert p.dcf.folder_name == "199MSDCF"
    assert p.dcf.file_name(1) == "DSC00001.JPG"
    assert p.exif.make == "SONY"
    assert p.exif.model == "ILCE-7M4"
    # 1920x1280 to match Cue's reference; small files, fast scrolling on LCD.
    assert p.image.width == 1920
    assert p.image.height == 1280
    assert p.image.width / p.image.height == 1.5  # 3:2
