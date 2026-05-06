"""Smoke test: the CLI loads, --help works, version prints, errors clean."""

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


def test_invalid_camera_exits_cleanly() -> None:
    """Unknown camera id must exit 1 with a friendly message, not a traceback."""
    result = runner.invoke(app, ["build", "--camera", "nope-no-such-camera", "--out", "/tmp/x"])
    assert result.exit_code == 1
    assert "nope-no-such-camera" in result.stdout
    assert "Traceback" not in result.stdout


def test_invalid_pose_exits_cleanly() -> None:
    result = runner.invoke(
        app,
        ["build", "--camera", "generic-3-2", "--pose", "P-999", "--out", "/tmp/x"],
    )
    assert result.exit_code == 1
    assert "P-999" in result.stdout
    assert "Traceback" not in result.stdout


def test_cameras_list_and_show() -> None:
    result = runner.invoke(app, ["cameras", "list"])
    assert result.exit_code == 0
    assert "sony-a7iv" in result.stdout

    result = runner.invoke(app, ["cameras", "show", "sony-a7iv"])
    assert result.exit_code == 0
    assert "Sony" in result.stdout
    assert "MSDCF" in result.stdout
