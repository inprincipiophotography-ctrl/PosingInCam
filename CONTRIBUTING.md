# Contributing to PosingInCam

Thanks for considering a contribution. There are three common ways to help, in increasing order of involvement:

1. [**Add or improve a pose**](#1-add-or-improve-a-pose) — author the YAML, optionally provide an illustration.
2. [**Add a camera profile**](#2-add-a-camera-profile) — for cameras we don't yet support.
3. [**Improve the generator**](#3-improve-the-generator) — code changes to the CLI, render pipeline, etc.

## 1. Add or improve a pose

You don't need to know Python. You'll edit one YAML file.

### Steps

1. **Pick a pose ID.** Look at `poses/` and grab the next free `P-NNN`.
2. **Copy the template.** Duplicate `poses/_template/pose.yaml` to `poses/p-NNN-<your-slug>.yaml`.
3. **Fill it in.** Follow the [Pose Schema](docs/POSE_SCHEMA.md) — every field is documented, with character limits.
4. **Add the illustration.** Either:
   - Drop a single-color line-art SVG in `assets/illustrations/<your-slug>.svg`, **or**
   - Open the PR with a placeholder note saying you need an illustration; the maintainers will commission one.
5. **Validate locally** (if you have Python):
   ```
   pip install -e .
   posingincam validate poses/p-NNN-<your-slug>.yaml
   ```
   If you don't have Python, push the PR and CI will validate.
6. **Open a PR.** CI will:
   - Validate the YAML.
   - Render a preview JPEG and post it as a PR comment.
7. A maintainer reviews, requests changes if needed, merges.

### Style guide

- The **verbal cue** is the heart of the card. Read [POSE_SCHEMA.md §Verbal cue style guide](docs/POSE_SCHEMA.md#verbal-cue-style-guide) before drafting.
- Positioning bullets should be **observable**, not abstract. "Right hand on his lapel" beats "show affection."
- Camera notes should be **lens + aperture + angle + distance**, in that order.

## 2. Add a camera profile

Follow [docs/CAMERA_COMPATIBILITY.md §Adding a new camera profile](docs/CAMERA_COMPATIBILITY.md#adding-a-new-camera-profile) and run [docs/CAMERA_TEST_PROTOCOL.md](docs/CAMERA_TEST_PROTOCOL.md).

For Tier 1 promotion (shipping in our default releases), we need:

- A profile YAML.
- A passing camera-in-the-loop test, with the photo of the camera's screen attached to the PR.

For Tier 2 (community-tested), the same minus owner verification.

## 3. Improve the generator

### Setup

```
git clone <repo>
cd PosingInCam
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pre-commit install
```

### Workflow

- Branch from `main`.
- Keep PRs scoped: one concern per PR.
- All code must pass `ruff check`, `mypy`, and `pytest`.
- New behavior needs tests.
- New rendering behavior needs a golden-image test (or an updated one with reasoning in the PR description).
- ADRs for non-trivial decisions: drop a numbered file in `docs/decisions/` based on `docs/decisions/_template.md` (TBD).

### Running things

```
make lint       # ruff + mypy
make test       # pytest
make build      # build the Essential pack for Sony A7 IV into dist/
make preview    # render P-001 and open it
```

### Code style

- Type annotations everywhere.
- No abbreviations in names. `camera_profile` not `cp`.
- Pydantic models live in `*/schema.py`.
- Side-effecting code lives in `cli/commands/` and `output/`. Render and pose modules should be pure.
- No global state.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Don't be a jerk. Photographers come from many backgrounds and we want all of them here.

## Licensing

Pose YAMLs and illustrations contributed via PR are licensed to the project under the same license as the repo. By submitting a PR you confirm you have the right to do so.

## Questions

Open a [Discussion](../../discussions) — we'd rather over-discuss than under.
