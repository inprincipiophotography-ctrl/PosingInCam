# Implementation Plan — PosingInCam

| Field | Value |
| --- | --- |
| **Status** | Draft v0.1 |
| **Last updated** | 2026-05-05 |

This is a milestone-driven plan. Each milestone has a clear definition of done and a single demo-able outcome. We do not start a milestone until the prior one's DoD is met.

## Timeline at a glance

| Milestone | Duration | Demo |
| --- | --- | --- |
| **M0** — Repo & decisions | 1 week | `pip install -e .` works; ADRs 0001–0008 merged. |
| **M1** — Render one card to disk | 1 week | `posingincam preview P-001` opens a JPEG that *looks* right. |
| **M2** — Sony A7 IV plays it back | 2 weeks | Hardware-tested: card shows in playback grid view. |
| **M3** — Multi-camera + DCF compliance | 2 weeks | Five Tier 1 profiles pass DCF validator and camera-in-loop test. |
| **M4** — Pose library & contributor flow | 2 weeks | 30 poses authored, contributor guide tested by a non-engineer. |
| **M5** — v1 polish and release | 1 week | PyPI release `0.1.0`; pre-built bundles on GitHub Releases. |

Total: ~9 weeks, single engineer, with 30 illustrations commissioned in parallel during M2–M4.

---

## M0 — Repo & decisions (week 1)

### Goals

Get the repo to a state where a contributor can clone it, install, and have a `posingincam --help` work, even if no real functionality exists yet.

### Tasks

- [ ] `pyproject.toml` with hatch backend, dependencies pinned (Pillow, piexif, pydantic, typer, jinja2, pyyaml, cairosvg).
- [ ] Lockfile (`requirements.lock` with hashes via `pip-compile`).
- [ ] `src/posingincam/cli/main.py` — Typer skeleton, all commands wired with `--help` text but `NotImplementedError` bodies.
- [ ] `Makefile` / `justfile` with `install`, `lint`, `test`, `format`, `build`.
- [ ] GitHub Actions: lint + test on push.
- [ ] Pre-commit hooks: ruff, mypy.
- [ ] ADR 0001–0003 written and merged.
- [ ] CONTRIBUTING.md, CODE_OF_CONDUCT.md, LICENSE.
- [ ] Issue templates and PR template.

### Definition of done

- `git clone && pip install -e . && posingincam --help` works on a clean macOS/Linux box.
- CI is green.
- All decisions in PRD §10 either resolved as ADRs or explicitly tracked as open issues.

---

## M1 — Render one card to disk (week 2)

### Goals

End-to-end pipeline for *one* pose into a JPEG-on-disk that visually represents the pose card. Doesn't have to be camera-compatible yet.

### Tasks

- [ ] `pose/schema.py`: Pydantic model for Pose (per ARCHITECTURE §3.1).
- [ ] `pose/loader.py`: load + validate one YAML.
- [ ] One handcrafted pose YAML in `poses/p-001-walking-hand-in-hand.yaml`.
- [ ] One commissioned (or AI-mocked, for now) line-art SVG illustration.
- [ ] `render/templates/card_default.svg.j2`: layout template.
- [ ] `render/layout.py`: bind pose into template.
- [ ] `render/rasterize.py`: SVG → PNG via cairosvg.
- [ ] `render/jpeg.py`: PNG → JPEG bytes.
- [ ] `cli/commands/preview.py`: `posingincam preview P-001` writes `/tmp/preview.jpg` and opens it.
- [ ] Unit tests for loader and naming.
- [ ] One golden-image test for the rendered card.

### Definition of done

- `posingincam preview P-001` produces a JPEG that:
  - Is < 500 KB.
  - Reads as a complete pose card (title, illustration, positioning, cue).
  - Looks acceptable to the project owner. (Subjective, but a clear thumbs-up is needed before M2.)
- Golden test passes.

### Risks

- SVG template iteration is slow without a designer in the loop. Mitigation: ship an obviously-rough v0 layout; iterate with the illustrator in M4.

---

## M2 — Sony A7 IV plays it back (weeks 3–4)

### Goals

Get the JPEG from M1 onto a real Sony A7 IV's playback. This is the most uncertain milestone — it's where reality meets spec.

### Tasks

- [ ] `cameras/profile.py` + `sony-a7iv.yaml` profile.
- [ ] `output/dcf.py`: folder/file name generation for Sony.
- [ ] `render/exif.py`: write EXIF Make/Model/DateTime.
- [ ] `render/thumbnail.py`: 160×120 JPEG from the illustration SVG.
- [ ] EXIF thumbnail embedding via piexif.
- [ ] `output/writer.py`: write to `dist/sony-a7iv/DCIM/199POSEX/DSC00001.JPG`.
- [ ] `cli/commands/build.py`: `posingincam build --camera sony-a7iv --pose P-001 --out dist/`.
- [ ] **Hardware test on Sony A7 IV**:
  - Format SD card.
  - Copy `dist/sony-a7iv/` to card root.
  - Insert in camera, switch to playback.
  - Verify: card appears in single-image view, zoom works, grid view shows the line-art thumbnail.
- [ ] If it doesn't work: iterate on EXIF tags. Compare against a real Sony JPEG with `exiftool`.
- [ ] Document findings in `docs/CAMERA_TEST_RESULTS.md`.
- [ ] ADR 0004 (EXIF spoofing strategy) finalized based on findings.

### Definition of done

- A photo of a Sony A7 IV's screen showing one of our cards in playback. (Yes, we save the photo to the repo.)
- Grid view shows line-art only, no text.
- Zoom-to-100% renders the card legibly.

### Risks

- **High**: Camera firmware may reject the image despite valid EXIF. Mitigation: budget two weeks; have backup plans (try without spoofing, try different image dimensions, consult Cue's output with exiftool if we can buy a single card from them as research).
- **Medium**: Test hardware availability. Mitigation: confirm hardware access before starting M2.

---

## M3 — Multi-camera + DCF compliance (weeks 5–6)

### Goals

Generalize from one camera to all Tier 1 cameras. Lock down DCF compliance so anyone can add a profile.

### Tasks

- [ ] `cameras/registry.py`: discover all profiles in `cameras/profiles/`.
- [ ] Profiles for: Canon R6 II, Canon R5, Nikon Z6 III, Nikon Z8, Sony A7 III.
- [ ] `tests/dcf_validator.py`: walks an output tree, asserts compliance.
- [ ] `cli/commands/build.py`: `--camera all` builds for every profile.
- [ ] `cli/commands/cameras.py`: `list`, `show <id>`.
- [ ] Parallel rendering (`ProcessPoolExecutor`).
- [ ] Performance budget enforcement in CI: a benchmark test fails if a render exceeds budget.
- [ ] Hardware tests for at least 3 of the 5 new profiles. (Document which we lacked.)
- [ ] ADR 0005, 0006, 0007 finalized.

### Definition of done

- `posingincam build --camera all --pose P-001 --out dist/` produces 6 valid trees.
- DCF validator passes on all of them.
- At least 3 cameras tested with hardware; rest marked "untested" in the matrix.

---

## M4 — Pose library & contributor flow (weeks 7–8)

### Goals

Scale from 1 pose to 30. Make it possible for non-engineer photographers to contribute.

### Tasks

- [ ] Author 30 pose YAMLs (the "Essential 30" pack).
- [ ] Commission 30 line-art illustrations (started in M2, landing now).
- [ ] `pose/pack.py`: pack manifest model.
- [ ] `cli/commands/build.py`: `--pack essential`.
- [ ] `cli/commands/validate.py`: lint poses, point to schema errors with line numbers.
- [ ] `cli/commands/install.py`: copy to mounted SD card with safety checks.
- [ ] `cli/commands/doctor.py`: dry-run preview + diagnostics.
- [ ] CONTRIBUTING.md: end-to-end "add a pose" walk-through with screenshots.
- [ ] PR template that runs `validate` and renders a preview as a PR comment via CI.
- [ ] **Test the contributor flow**: ask a non-engineer photographer to add one pose start to finish. Time it. Fix friction.
- [ ] ADR 0008 (update strategy) finalized.

### Definition of done

- 30 poses committed and rendering cleanly.
- A contributor with no Python experience successfully merges a pose PR (timed: ≤ 30 minutes from "I have an idea" to "PR merged").
- Bundle size for the Essential 30 pack on Sony A7 IV: ≤ 30 MB.

---

## M5 — v1 polish and release (week 9)

### Goals

Make it real. Tag v0.1.0, push to PyPI, ship pre-built bundles.

### Tasks

- [ ] Documentation pass: every public command has examples in the README.
- [ ] Website / landing page (out of scope for the repo, tracked separately).
- [ ] `posingincam install --target` UX polish: clear errors, dry-run by default, `--apply` to commit.
- [ ] Lightroom smart-collection filter file (`assets/lightroom/exclude-posingincam.lrtemplate` or equivalent).
- [ ] CI: tag-triggered release workflow that builds and uploads bundles.
- [ ] Tag `v0.1.0`, push to PyPI.
- [ ] Announcement post draft (lives in `docs/announcement-draft.md`).
- [ ] Beta program: 5–10 photographers receive bundles + feedback form.

### Definition of done

- `pip install posingincam` works for a stranger.
- GitHub Releases page has bundles for each Tier 1 camera.
- 5+ photographers in active beta.

---

## Post-v1 backlog (rough sketch)

- Tier 2 camera profiles (Fuji X-T5, Panasonic S5 II, Sony A7R V, Canon R7, Nikon Zf).
- Branding / customization at build time (logo, color palette).
- More packs: wedding-day, engagement, boudoir, families, golden-hour, prompts.
- Web preview gallery (static site built from the library).
- Single-binary distribution for non-Python users.
- Smart pack curation (e.g. "10 quick-shoot poses for tight venues").
- i18n: multilingual cards.
- Community pose marketplace (much later).

---

## Roles and assumptions

- **One engineer** through M5. Sufficient for the scope.
- **One illustrator** commissioned in parallel from M2; delivers ~5 illustrations/week.
- **One photographer-tester** with access to Sony A7 IV in M2, and 2–3 more cameras by M3. Must be lined up before M2.
- No designer in the loop until M4 (we ship rough layouts and iterate).

## Risk register (rolled up)

See PRD §9. The killer risks are M2 (does playback even work?) and M4 (do we get the illustrations on time?). Both are de-risked by being upfront and starting hardware/illustration work in parallel with engineering.
