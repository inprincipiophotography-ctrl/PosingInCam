"""Repository-relative path helpers."""

from __future__ import annotations

from pathlib import Path


def find_repo_root(start: Path | None = None) -> Path:
    """Walk upward looking for a marker that identifies the repo root.

    Used by the CLI when invoked from anywhere inside the repo so that
    `--pose P-001` and relative illustration paths resolve correctly.
    """
    here = (start or Path.cwd()).resolve()
    for candidate in (here, *here.parents):
        if (candidate / "pyproject.toml").is_file() and (candidate / "poses").is_dir():
            return candidate
    return here
