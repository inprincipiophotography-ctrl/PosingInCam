"""posingincam build -- render JPEG cards into a DCF tree."""

from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console

from posingincam.cameras.registry import get_profile
from posingincam.output.writer import render_cards, write_to_disk
from posingincam.pose.loader import load_poses
from posingincam.util import find_repo_root

console = Console()


def command(
    camera: str = typer.Option(..., "--camera", help="Camera profile id (e.g. sony-a7iv)."),
    out: Path = typer.Option(..., "--out", help="Output directory."),
    pack: str | None = typer.Option(None, "--pack", help="Limit to one pack."),
    pose: str | None = typer.Option(None, "--pose", help="Render only one pose by id."),
    overwrite: bool = typer.Option(False, "--overwrite", help="Overwrite existing files."),
) -> None:
    """Render cards into <out>/DCIM/<camera-folder>/."""
    repo_root = find_repo_root()
    profile = get_profile(camera)

    poses = load_poses(repo_root / "poses")
    if pose:
        poses = [p for p in poses if p.id == pose]
        if not poses:
            console.print(f"[red]pose {pose} not found[/red]")
            raise typer.Exit(code=1)
    elif pack:
        poses = [p for p in poses if p.pack == pack]
        if not poses:
            console.print(f"[red]no poses in pack {pack!r}[/red]")
            raise typer.Exit(code=1)

    console.print(
        f"Rendering [bold]{len(poses)}[/bold] pose(s) for "
        f"[bold]{profile.display_name}[/bold] → {out}"
    )

    cards = render_cards(poses, profile, illustration_root=repo_root)
    written = write_to_disk(cards, out, overwrite=overwrite)

    total_kb = sum(c.bytes.__sizeof__() for c in cards) / 1024
    for path in written:
        size_kb = path.stat().st_size / 1024
        console.print(f"  [green]✓[/green] {path.relative_to(out)}  ({size_kb:.0f} KB)")
    console.print(
        f"\n[green]done[/green] · {len(written)} file(s), "
        f"~{total_kb:.0f} KB total in {out}"
    )
