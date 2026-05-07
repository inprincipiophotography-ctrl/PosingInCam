# Cue EXIF Analysis

| Field | Value |
| --- | --- |
| **Source** | Cue Sampler — Sony, free download from [shootwithcue.com](https://www.shootwithcue.com) |
| **Sample analyzed** | 32 JPEGs across 4 variants (Dark/Light × Landscape/Portrait) |
| **Tooling** | exiftool 12.76 |

This document captures what we learned by reverse-engineering Cue's actual product, and is the reasoning behind each step in `cardify.sh`. **The sample files themselves are NOT in the repo** — they're third-party IP, used for one-time local diff and gitignored.

---

## Cue's strategy: real-photo template

Every Cue card has identical Sony maker notes that look like a real shoot:

| Tag | Value (same across every card we inspected) |
| --- | --- |
| `Make` | `SONY` |
| `Model` | `ILCE-7SM3` (Sony A7S III) |
| `Software` | `ILCE-7SM3 v2.00` (Sony firmware string format) |
| `ShutterCount` | `1410` |
| `InternalSerialNumber` | `44ff0000c209` |
| `ISO` | `12800` |
| `ExposureTime` | `1/50` |
| `BatteryLevel` | `90%` |
| `BrightnessValue` | `-13.99` |
| `Image dimensions` | `1920 × 1280` |

`DateTimeOriginal` increments by ~1 second per card (`22:54:54`, `22:54:55`, `22:54:57`, ...) — they bump the timestamp per file rather than freeze it.

Workflow inferred:

1. Take **one** real photo with a Sony A7S III.
2. Render the card design separately.
3. Composite the card onto the photo's pixel data.
4. Re-encode the JPEG but **preserve the entire MakerNotes blob** (the Sony-proprietary IFD that contains shutter count, serial, lens info, etc.).
5. Bump `DateTimeOriginal` per file.

Smoking gun: identical `ShutterCount: 1410` across 32 cards — only possible by reusing one shot's MakerNotes.

---

## Tag count: 194 vs ~40 from a naive synth

Cue ships ~194 EXIF tags per card. The deltas between Cue's spec and a naive synthesized JPEG (no MakerNotes, just standard EXIF) are:

- **`[ExifIFD]`**: ~30 tags Cue has — basic shooting params (ExifVersion, FlashpixVersion, ColorSpace, ComponentsConfiguration, scene/exposure metadata).
- **`[Sony]`**: ~80 maker-note tags (ShutterCount, BatteryLevel, Lens info, Sony Picture Profile, …).
- **`[InteropIFD]`**: `InteropIndex: R98` (DCF basic-file marker) and `InteropVersion: 0100`. **Critical for DCF recognition.**
- **`[IFD1]`**: thumbnail-related tags (Make, Model, Software, ModifyDate).
- **`[PrintIM]`**: Sony-specific print marker.

`cardify.sh` solves all of this at once by **copying the entire EXIF block from a real Sony shot the user provides**, then surgically replacing the parts that have to differ (image dimensions, thumbnail, R98 marker enforcement). That's how we get 1:1 EXIF parity with Cue without having to reconstruct MakerNotes by hand.

---

## Image dimensions: 1920×1280

Cue always ships 1920×1280 (~2.5 MP) regardless of the card design's aspect ratio. Result: ~150–210 KB per file. Both dimensions are multiples of 16, the JPEG MCU block size — Sony cameras reject non-aligned dimensions on some firmwares.

For portrait cards, Cue still uses 1920×1280 file pixels, with the content rotated 90° CCW into the landscape canvas, and EXIF `Orientation=6` telling the camera to rotate 90° CW for display. This is exactly how a real Sony portrait shot is stored. `cardify.sh` follows this convention so Sony's auto-rotation behaves correctly when the user turns the body.

---

## YCbCr subsampling: 4:2:2

Cue uses 4:2:2 chroma subsampling. macOS's `sips` defaults to 4:2:0, which some Sony firmwares reject (the camera shows "unable to display" and falls back to the embedded thumbnail). `cardify.sh` prefers ImageMagick or Pillow specifically for this control; `sips` is only the last-resort fallback.

---

## Conventions we kept different from Cue

| Cue's choice | Ours | Why |
| --- | --- | --- |
| Full Sony MakerNotes from a Sony A7S III | MakerNotes from the user's own template shot | The user supplies a real photo from their actual body. Make/Model end up matching their exact body (e.g. `ILCE-7M4`), which is more likely to pass any vendor-specific gating than spoofing as a different model. |
| No `ImageDescription` marker | None either | Removed in cleanup; we no longer need a programmatic marker now that Python tooling is gone. |
| Recent `DateTimeOriginal`; cards mix with real shoots by date | Inherited from template (then `cardify.sh` does not bump it) | Optional: if you want cards sorted apart from real shoots, edit `cardify.sh` to set a fixed past date. |

---

## What this informs in `cardify.sh`

Each numbered step in the script maps to a finding here:

1. **Re-encode (baseline DCT, 4:2:2, q90)** — matches Cue's encoding to bypass Sony firmware quirks.
2. **`-tagsFromFile -all:all`** — copies the entire EXIF block (including MakerNotes) from the user's template shot.
3. **Strip IFD1 + ExifImageWidth/Height + ICC + XMP + IPTC** — the template's thumbnail and dimensions are wrong for our card.
4. **Write actual ExifImageWidth/Height** — 1920×1280.
5. **Force `R98 - DCF basic file (sRGB)` + `Orientation`** — defensively, in case the template-copy phase silently drops them.
6. **Generate fresh thumbnail** — from the actual card, embedded in IFD1.

---

## Anti-pattern reminder

The Cue sample JPGs cannot be redistributed. We used them for one-time analysis under fair-use ("compatibility testing of an interoperable system"), wrote down what we needed to know, then removed them from the repo. They are gitignored; don't re-add them.
