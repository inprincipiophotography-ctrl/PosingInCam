"""posingincam cameras list / show."""

from __future__ import annotations

import typer
from rich.console import Console
from rich.table import Table

from posingincam.cameras.registry import CameraNotFoundError, get_profile, list_profiles

console = Console()


def list_cmd() -> None:
    """List all registered camera profiles."""
    profiles = list_profiles()
    table = Table(title="Camera profiles")
    table.add_column("id")
    table.add_column("name")
    table.add_column("DCF folder")
    table.add_column("file prefix")
    table.add_column("WxH")
    for p in profiles:
        table.add_row(
            p.id,
            p.display_name,
            p.dcf.folder_name,
            p.dcf.file_prefix,
            f"{p.image.width}×{p.image.height}",
        )
    console.print(table)


def show_cmd(camera_id: str) -> None:
    """Show details for one camera profile."""
    try:
        p = get_profile(camera_id)
    except CameraNotFoundError as exc:
        console.print(f"[red]{exc}[/red]")
        raise typer.Exit(code=1) from None
    console.print(f"[bold]{p.display_name}[/bold] ({p.id})")
    console.print(f"  manufacturer  {p.manufacturer}")
    console.print(f"  DCF folder    {p.dcf.folder_name}")
    console.print(f"  file pattern  {p.dcf.file_prefix}NNNN.JPG (start at {p.dcf.starting_index})")
    console.print(f"  image         {p.image.width}×{p.image.height} q={p.image.jpeg_quality}")
    console.print(f"  EXIF          {p.exif.make} / {p.exif.model}")
    if p.notes:
        console.print(f"  notes         {p.notes.strip()}")
