"""posingincam preview -- render one card to a temp file and open it."""

from __future__ import annotations

import os
import platform
import subprocess
import tempfile
from pathlib import Path

import typer
from rich.console import Console

from posingincam.cameras.registry import get_profile
from posingincam.output.writer import render_card
from posingincam.pose.loader import load_poses
from posingincam.util import find_repo_root

console = Console()


def _open_path(path: Path) -> None:
    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.run(["open", str(path)], check=False)
        elif system == "Windows":
            os.startfile(str(path))  # type: ignore[attr-defined]
        else:
            subprocess.run(["xdg-open", str(path)], check=False)
    except FileNotFoundError:
        # No xdg-open / open is fine; the caller still sees the path.
        pass


def command(
    pose_id: str = typer.Argument(..., help="Pose id, e.g. P-001."),
    camera: str = typer.Option("generic-3-2", "--camera", help="Camera profile id."),
    out: Path | None = typer.Option(None, "--out", help="Override output file path."),
    open_after: bool = typer.Option(True, "--open/--no-open", help="Open the file after writing."),
) -> None:
    """Render one card to a temp file (or --out) and open it."""
    repo_root = find_repo_root()
    profile = get_profile(camera)

    poses = load_poses(repo_root / "poses")
    pose = next((p for p in poses if p.id == pose_id), None)
    if pose is None:
        console.print(f"[red]pose {pose_id} not found in {repo_root / 'poses'}[/red]")
        raise typer.Exit(code=1)

    body = render_card(pose, profile, illustration_root=repo_root)

    target = out or Path(tempfile.gettempdir()) / f"posingincam-preview-{pose.id}-{camera}.jpg"
    target.write_bytes(body)
    size_kb = len(body) / 1024
    console.print(
        f"[green]✓[/green] {pose.id} → {target}  ({size_kb:.1f} KB, "
        f"{profile.image.width}×{profile.image.height})"
    )
    if open_after:
        _open_path(target)
