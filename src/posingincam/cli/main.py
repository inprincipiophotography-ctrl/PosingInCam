"""Typer CLI entrypoint."""

from __future__ import annotations

import typer

from posingincam import __version__
from posingincam.cli.commands import build as build_cmd
from posingincam.cli.commands import cameras as cameras_cmd
from posingincam.cli.commands import preview as preview_cmd
from posingincam.cli.commands import validate as validate_cmd

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


app.command(name="build")(build_cmd.command)
app.command(name="validate")(validate_cmd.command)
app.command(name="preview")(preview_cmd.command)
cameras_app.command(name="list")(cameras_cmd.list_cmd)
cameras_app.command(name="show")(cameras_cmd.show_cmd)


@app.command()
def install() -> None:
    """Build (if needed) and copy onto an SD card. (M4 milestone.)"""
    raise NotImplementedError("install is M4 work; see docs/IMPLEMENTATION_PLAN.md")


@app.command()
def doctor() -> None:
    """Diagnose an SD card mount. (M4 milestone.)"""
    raise NotImplementedError("doctor is M4 work; see docs/IMPLEMENTATION_PLAN.md")


if __name__ == "__main__":
    app()
