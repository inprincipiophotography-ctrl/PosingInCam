"""posingincam validate -- lint pose YAMLs against the schema."""

from __future__ import annotations

import sys
from pathlib import Path

import typer
from rich.console import Console

from posingincam.pose.loader import PoseLoadError, find_pose_files, load_pose

console = Console()


def run(path: Path) -> int:
    files = find_pose_files(path)
    if not files:
        console.print(f"[yellow]no pose files found under {path}[/yellow]")
        return 0

    failures: list[tuple[Path, str]] = []
    for f in files:
        try:
            load_pose(f)
        except PoseLoadError as exc:
            failures.append((f, exc.message))

    if failures:
        for f, msg in failures:
            console.print(f"[red]✗[/red] {f}")
            for line in msg.splitlines():
                console.print(f"    {line}")
        console.print(f"\n[red]{len(failures)} of {len(files)} pose(s) failed validation[/red]")
        return 1

    console.print(f"[green]✓[/green] {len(files)} pose(s) valid")
    return 0


def command(
    path: Path = typer.Argument(Path("poses"), help="Pose file or directory."),
) -> None:
    """Validate one or many pose YAMLs against the schema."""
    sys.exit(run(path))
