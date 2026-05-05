# Camera Compatibility Matrix

| Field | Value |
| --- | --- |
| **Status** | Draft v0.1 |
| **Last updated** | 2026-05-05 |

This document is the source of truth for which cameras we ship a profile for, what their DCF conventions are, and what we have actually tested.

## Tiers

- **Tier 1** — must work on launch. Owner-tested with hardware. Profile + golden test + camera-in-loop test result archived.
- **Tier 2** — profile shipped, community-tested. We accept the profile if a contributor can demonstrate it works.
- **Tier 3** — best-effort generic profile (`generic-3-2`, `generic-4-3`). May or may not play back correctly.

## Tier 1 — MVP scope

| Camera | Manufacturer | DCF Folder | DCF File Prefix | Image (W×H) | EXIF Make/Model | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Sony A7 IV | Sony | `100MSDCF` | `DSC0` | 3840×2560 | `SONY` / `ILCE-7M4` | Profile in M2 |
| Sony A7 III | Sony | `100MSDCF` | `DSC0` | 3840×2560 | `SONY` / `ILCE-7M3` | Profile in M3 |
| Canon R6 Mark II | Canon | `100CANON` | `IMG_` | 3840×2560 | `Canon` / `Canon EOS R6m2` | Profile in M3 |
| Canon R5 | Canon | `100CANON` | `IMG_` | 3840×2560 | `Canon` / `Canon EOS R5` | Profile in M3 |
| Nikon Z6 III | Nikon | `100NCZ_6` | `DSC_` | 3840×2560 | `NIKON CORPORATION` / `NIKON Z 6_3` | Profile in M3 |
| Nikon Z8 | Nikon | `100NCZ_8` | `DSC_` | 3840×2560 | `NIKON CORPORATION` / `NIKON Z 8` | Profile in M3 |

> Folder names and file prefixes are based on what these cameras *write*, mirrored in our profile so playback treats our files as native. Exact Nikon Z conventions need confirmation in M3 hardware test.

## Tier 2 — post-MVP (M6+)

| Camera | Manufacturer | DCF Folder | DCF File Prefix |
| --- | --- | --- | --- |
| Fujifilm X-T5 | Fujifilm | `100_FUJI` | `DSCF` |
| Fujifilm X-H2 | Fujifilm | `100_FUJI` | `DSCF` |
| Panasonic Lumix S5 II | Panasonic | `100_PANA` | `P101` (varies) |
| Sony A7R V | Sony | `100MSDCF` | `DSC0` |
| Sony FX3 | Sony | `100MSDCF` | `DSC0` |
| Canon R7 | Canon | `100CANON` | `IMG_` |
| Nikon Zf | Nikon | `100NC_ZF` | `DSC_` |
| Leica SL3 | Leica | `100LEICA` | `L100` |

## Tier 3 — generic fallback

| Profile | Aspect | Notes |
| --- | --- | --- |
| `generic-3-2` | 3:2 | Conservative defaults, may need user tweaks. |
| `generic-4-3` | 4:3 | For micro four thirds (Olympus / OM / Panasonic GH). |
| `generic-1-1` | 1:1 | For anything weird. |

## DCF reference (recap)

The Design rule for Camera File system (JEITA CP-3461) requires:

- Files live under `<volume>/DCIM/`.
- Subfolders named `NNNXXXXX` where `NNN` ∈ 100..999 and `XXXXX` is 5 alphanumeric characters.
- Files named `XXXXNNNN.JPG` where `XXXX` is 4 alphanumeric characters and `NNNN` ∈ 0001..9999.
- Files are EXIF JPEGs with at minimum Make, Model, Orientation tags and an embedded 160×120 thumbnail.

## Per-vendor quirks (to verify)

Captured here as we learn. Update during M2/M3 hardware testing.

### Sony

- Default folder: `100MSDCF`. Cameras auto-create new folders by incrementing the leading number.
- File prefix `DSC0` (or `DSC1`, etc., depending on body and adobe RGB toggle).
- Playback recognizes any DCF-compliant JPEG copied to the card.
- `MAH_FILE_FORMAT.IND` and other `AVCHD/PRIVATE/` directories are video-related, do not affect us.

### Canon

- Default folder: `100CANON`.
- File prefix: `IMG_` (sRGB) or `_IMG` (Adobe RGB) — leading underscore convention.
- `MISC/` folder used for DPOF — we may write a DPOF protect file here in M3.
- R-series tested to scroll mixed JPEGs in playback OK per online reports.

### Nikon

- Default folder name varies by body model: `100NCZ_8` for Z8, `100NCD850` for D850, etc.
- File prefix: `DSC_` (sRGB) or `_DSC` (Adobe RGB).
- Nikon NEF is .NEF; we are JPEG-only so no concern.

### Fujifilm

- Default folder: `100_FUJI`.
- File prefix: `DSCF`.
- Underscore in folder name (still DCF-valid).

### Panasonic

- Default folder: `100_PANA`.
- File prefix varies more than other vendors (`P101`, etc.). May need to allow per-body.

## Adding a new camera profile

1. Read the camera's user manual and confirm the default DCIM folder name and file naming.
2. Confirm with `exiftool` against a JPEG taken with that camera.
3. Copy `src/posingincam/cameras/profiles/_template.yaml` and fill in the values.
4. Build a single pose: `posingincam build --camera <new-id> --pose P-001 --out /tmp/test`.
5. Copy to a fresh SD card, insert in the camera, verify playback in single + grid view.
6. Update this matrix and `docs/CAMERA_TEST_RESULTS.md` with results.
