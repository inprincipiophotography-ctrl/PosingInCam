# ADR 0001: Implementation language is Python 3.11+

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-05-05 |
| **Deciders** | TBD |

## Context

We need a language for the CLI generator. The work is: parse YAML, validate against a schema, render an SVG template, rasterize SVG to PNG, encode JPEG, write EXIF including an embedded thumbnail, lay out files in DCF folders.

The dominant constraints are:

1. **Image-processing ecosystem.** The hardest parts are SVG→raster, JPEG encoding, and writing EXIF with an embedded thumbnail. Whichever language has the most mature, well-trodden tools here saves us weeks.
2. **Contributor accessibility.** We expect non-engineer photographers to author poses (YAML only) but also occasionally tweak templates. The language should not be a wall.
3. **Iteration speed.** Building this is mostly small scripts, not a perf-critical service. Compile times and ceremony are pure tax.

## Options considered

- **Python 3.11+** with Pillow, piexif, cairosvg, Typer, Pydantic, Jinja2.
- **Node.js + TypeScript** with sharp, exiftool-vendored, satori/resvg, commander, zod, handlebars.
- **Rust** with image, kamadak-exif, resvg, clap, serde.
- **Go** with imaging, goexif (read-only mostly), resvg via FFI.

## Decision

**Python 3.11+.**

## Consequences

- We get the deepest ecosystem for image work, including a mature EXIF-with-thumbnail writer (`piexif`).
- YAML + Pydantic v2 gives us a clean validation story.
- Typer makes the CLI ergonomic without much code.
- Distribution to non-Python users is harder than a Go/Rust binary; we mitigate with PyInstaller bundles in M5+.
- Performance is not a concern at our scale (hundreds of small JPEGs).
- Adopting `uv` and `ruff` keeps Python's traditional toolchain pain manageable.

## Alternatives, rejected

- **Node + TS**: sharp is excellent, but writing EXIF with an embedded thumbnail is awkward; we'd be shelling out to exiftool. The pose-author experience is also weaker (zod has worse error messages than Pydantic for human-edited YAML).
- **Rust**: contributor barrier dominates the perf win; we don't need 100ms-per-image speeds.
- **Go**: EXIF write-with-thumbnail story is even worse than Node's; image library is decent but not best-in-class.
