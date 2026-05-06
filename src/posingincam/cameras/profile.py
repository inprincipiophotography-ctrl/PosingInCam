"""Camera profile model and YAML loader."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from ruamel.yaml import YAML

DCF_FOLDER_TAG_PATTERN = re.compile(r"^[A-Z0-9_]{5}$")
DCF_FILE_PREFIX_PATTERN = re.compile(r"^[A-Z0-9_]{4}$")
PROFILE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

_yaml = YAML(typ="safe")


class DCFConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    folder_number: int = Field(199, ge=100, le=999)
    folder_tag: str
    file_prefix: str
    starting_index: int = Field(1, ge=1, le=9999)

    @field_validator("folder_tag")
    @classmethod
    def _validate_folder_tag(cls, v: str) -> str:
        if not DCF_FOLDER_TAG_PATTERN.match(v):
            raise ValueError(
                f"folder_tag must be 5 uppercase alphanumeric/underscore chars, got {v!r}"
            )
        return v

    @field_validator("file_prefix")
    @classmethod
    def _validate_file_prefix(cls, v: str) -> str:
        if not DCF_FILE_PREFIX_PATTERN.match(v):
            raise ValueError(
                f"file_prefix must be 4 uppercase alphanumeric/underscore chars, got {v!r}"
            )
        return v

    @property
    def folder_name(self) -> str:
        return f"{self.folder_number:03d}{self.folder_tag}"

    def file_name(self, index: int) -> str:
        if not 1 <= index <= 9999:
            raise ValueError(f"DCF file index must be 1..9999, got {index}")
        return f"{self.file_prefix}{index:04d}.JPG"


class ImageConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    width: int = Field(..., ge=640, le=12000)
    height: int = Field(..., ge=480, le=12000)
    jpeg_quality: int = Field(85, ge=1, le=100)
    color_space: str = "sRGB"


class ExifConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    make: Annotated[str, StringConstraints(min_length=1, max_length=32)]
    model: Annotated[str, StringConstraints(min_length=1, max_length=32)]
    software: str = "posingincam/0.1"
    date_time_original: str = "2000:01:01 00:00:01"
    spoof_make_model: bool = True


class CameraProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    display_name: str
    manufacturer: str
    dcf: DCFConfig
    image: ImageConfig
    exif: ExifConfig
    notes: str | None = None

    @field_validator("id")
    @classmethod
    def _validate_id(cls, v: str) -> str:
        if not PROFILE_ID_PATTERN.match(v):
            raise ValueError(f"profile id must be kebab-case, got {v!r}")
        return v


def load_profile(path: Path) -> CameraProfile:
    if not path.is_file():
        raise FileNotFoundError(path)
    with path.open("r", encoding="utf-8") as fp:
        raw = _yaml.load(fp)
    return CameraProfile(**raw)
