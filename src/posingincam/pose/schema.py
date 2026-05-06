"""Pydantic models for the pose YAML schema. See docs/POSE_SCHEMA.md."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

POSE_ID_PATTERN = re.compile(r"^P-\d{3}$")
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

ShortStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class Positioning(BaseModel):
    model_config = ConfigDict(extra="forbid")

    her: list[Annotated[str, StringConstraints(min_length=1, max_length=80)]] = Field(
        ..., min_length=1, max_length=4
    )
    him: list[Annotated[str, StringConstraints(min_length=1, max_length=80)]] = Field(
        ..., min_length=1, max_length=4
    )


class CameraNotes(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lens: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    aperture: Annotated[str, StringConstraints(min_length=1, max_length=30)]
    angle: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    distance: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    notes: Annotated[str, StringConstraints(max_length=200)] | None = None


class Pose(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    slug: str
    title: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    pack: Annotated[str, StringConstraints(min_length=1, max_length=40)]
    illustration: Annotated[str, StringConstraints(min_length=1)]

    positioning: Positioning
    camera_notes: CameraNotes
    verbal_cue: Annotated[str, StringConstraints(min_length=1, max_length=240)]

    difficulty: int = Field(1, ge=1, le=3)
    tags: list[str] = Field(default_factory=list)
    variations: list[Annotated[str, StringConstraints(min_length=1, max_length=100)]] = Field(
        default_factory=list, max_length=3
    )
    authored_by: Annotated[str, StringConstraints(max_length=60)] | None = None
    art_credit: Annotated[str, StringConstraints(max_length=60)] | None = None
    version: int = Field(1, ge=1)

    source_path: Path | None = Field(None, exclude=True)

    @field_validator("id")
    @classmethod
    def _validate_id(cls, v: str) -> str:
        if not POSE_ID_PATTERN.match(v):
            raise ValueError(f"id must match pattern P-NNN, got {v!r}")
        return v

    @field_validator("slug")
    @classmethod
    def _validate_slug(cls, v: str) -> str:
        if not SLUG_PATTERN.match(v):
            raise ValueError(f"slug must be kebab-case (a-z, 0-9, hyphens), got {v!r}")
        return v

    def numeric_id(self) -> int:
        return int(self.id.split("-")[1])
