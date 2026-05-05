"""Typer CLI entrypoint. Commands are stubs until M1+; see docs/IMPLEMENTATION_PLAN.md."""

from __future__ import annotations

from pathlib import Path

import typer

from posingincam import __version__

app = typer.Typer(
    name="posingincam",
    help="Posing reference cards on the back of your camera. No phone.",
    no_args_is_help=True,
)
cameras_app = typer.Typer(help="Manage camera profiles.", no_args_is_help=True)
app.add_typer(cameras_app, name="cameras")


@app.command()
def version() -> None:
    """Print the installed version."""
    typer.echo(__version__)


@app.command()
def build(
    camera: str = typer.Option(..., "--camera", help="Camera profile id (e.g. sony-a7iv)."),
    pack: str | None = typer.Option(None, "--pack", help="Limit to one pack."),
    pose: str | None = typer.Option(None, "--pose", help="Render only one pose by id."),
    out: Path = typer.Option(..., "--out", help="Output directory."),
) -> None:
    """Render JPEG cards for the chosen camera into <out>/DCIM/..."""
    raise NotImplementedError("M2 milestone — see docs/IMPLEMENTATION_PLAN.md")


@app.command()
def install(
    camera: str = typer.Option(..., "--camera"),
    target: Path = typer.Option(..., "--target", help="Mount path of the SD card."),
    apply: bool = typer.Option(False, "--apply", help="Actually write. Default is dry-run."),
) -> None:
    """Build (if needed) and copy onto an SD card mounted at --target."""
    raise NotImplementedError("M4 milestone")


@app.command()
def validate(
    path: Path = typer.Argument(Path("poses"), help="Pose file or directory."),
) -> None:
    """Validate one or many pose YAMLs against the schema."""
    raise NotImplementedError("M1 milestone")


@app.command()
def preview(
    pose_id: str = typer.Argument(..., help="Pose id, e.g. P-001."),
    camera: str = typer.Option("generic-3-2", "--camera"),
) -> None:
    """Render one card to a temp file and open it."""
    raise NotImplementedError("M1 milestone")


@app.command()
def doctor(
    target: Path = typer.Option(..., "--target", help="SD card mount to inspect."),
) -> None:
    """Diagnose an SD card mount and what install would do."""
    raise NotImplementedError("M4 milestone")


@cameras_app.command("list")
def cameras_list() -> None:
    """List all registered camera profiles."""
    raise NotImplementedError("M3 milestone")


@cameras_app.command("show")
def cameras_show(camera_id: str) -> None:
    """Show details for one camera profile."""
    raise NotImplementedError("M3 milestone")


if __name__ == "__main__":
    app()
