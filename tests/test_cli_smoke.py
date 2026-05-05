"""Smoke test: the CLI loads, --help works, version prints."""

from typer.testing import CliRunner

from posingincam.cli.main import app

runner = CliRunner()


def test_help() -> None:
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "posingincam" in result.stdout.lower()


def test_version() -> None:
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert result.stdout.strip()
