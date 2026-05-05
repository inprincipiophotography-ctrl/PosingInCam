# PosingInCam

> Posing reference cards on the back of your camera. No phone. No fumble. No "let me check Pinterest real quick."

PosingInCam is a programmatic generator that turns a YAML pose library into a folder of camera-native JPEGs you drop onto your SD card. The cards show up in playback exactly like your own photos — full zoom, grid view, the works — so you can scroll a curated pose library between shots without ever touching your phone.

## What you get

- **100+ curated poses** for couples, weddings, engagements, boudoir, families.
- **Per-pose card** with: pose title, line illustration, positioning for *her*, positioning for *him*, camera notes (lens, angle, settings), and the exact verbal cue to give the couple.
- **Custom embedded thumbnail** — just the line drawing, no text — so the camera's grid view becomes a visual pose finder.
- **Per-camera output bundles** that respect each manufacturer's DCF folder/file naming, so playback "just works" on Sony Alpha, Canon EOS R, Nikon Z, Fujifilm X, Panasonic Lumix.
- **~20–100 MB total** for the full library; individual cards are tens to a few hundred KB.

## How it works

```
poses/*.yaml    ──►   posingincam build   ──►   dist/<camera>/DCIM/...
(human-edited)         (Python CLI)              (drop onto SD card)
```

Each pose is a single YAML file. The CLI renders an SVG layout, rasterizes it to a JPEG sized for the target camera, embeds a clean line-art thumbnail in the EXIF segment, and writes it into a DCF-compliant folder structure.

## Quick start

```bash
# Install
pip install -e .

# List available cameras
posingincam cameras list

# Render the full library for a Sony A7 IV
posingincam build --camera sony-a7iv --pack essential --out dist/sony-a7iv

# Copy onto SD card (mounted at /Volumes/SDCARD)
posingincam install --camera sony-a7iv --target /Volumes/SDCARD
```

Detailed docs:

- [Product Requirements Document](docs/PRD.md)
- [Technical Architecture](docs/ARCHITECTURE.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Camera Compatibility Matrix](docs/CAMERA_COMPATIBILITY.md)
- [Pose Schema](docs/POSE_SCHEMA.md)
- [Contributing](CONTRIBUTING.md)

## Status

Pre-alpha. Currently scaffolding the repo and locking down architecture decisions. See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the milestone roadmap.

## License

TBD — see [LICENSE](LICENSE).
