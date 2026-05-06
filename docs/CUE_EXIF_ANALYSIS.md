# Cue EXIF Analysis (M2 hardware-prep)

| Field | Value |
| --- | --- |
| **Date** | 2026-05-06 |
| **Source** | Cue Sampler — Sony, free download from shootwithcue.com |
| **Sample analyzed** | 32 JPEGs across 4 variants (Dark/Light × Landscape/Portrait) |
| **Tooling** | exiftool 12.76 |

This document captures what we learned by inspecting Cue's actual product. **The sample files themselves are NOT in the repo** — they're third-party IP we used for one-time local diff and have since removed. Findings are summarized here so we don't need them again.

## Key facts

### Cue's EXIF strategy is "real photo template"

Every Cue card has identical Sony maker notes that look like a real shoot:

| Tag | Value (same across every card we inspected) |
| --- | --- |
| `Make` | `SONY` |
| `Model` | `ILCE-7SM3` (Sony A7S III, not A7 IV) |
| `Software` | `ILCE-7SM3 v2.00` (Sony firmware string format) |
| `ShutterCount` | `1410` |
| `InternalSerialNumber` | `44ff0000c209` |
| `ISO` | `12800` |
| `ExposureTime` | `1/50` |
| `BatteryLevel` | `90%` |
| `BrightnessValue` | `-13.99` |
| `Image dimensions` | `1920 × 1280` |

`DateTimeOriginal` increments by ~1 second per card (`22:54:54`, `22:54:55`, `22:54:57`, ...) — they bump the time per file rather than freeze it.

This is consistent with the workflow:

1. They took **one** real photo with a Sony A7S III.
2. They render their card design.
3. They composite the card onto the photo's pixel data (or replace it).
4. They re-encode the JPEG but **preserve the entire MakerNotes blob** (the Sony-proprietary IFD that contains shutter count, serial, lens info, etc.).
5. They bump `DateTimeOriginal` per file.

The smoking gun is identical `ShutterCount: 1410` across 32 cards — that can only happen if you reuse one shot's MakerNotes.

### Tag count: 194 vs 40

Cue ships ~194 EXIF tags per card. Our pre-fix output ships 40. The deltas live in:

- **`[ExifIFD]`**: ~30 tags Cue has that we miss (basic shooting params, ExifVersion, FlashpixVersion, ColorSpace, ComponentsConfiguration, scene/exposure metadata).
- **`[Sony]`**: ~80 maker-note tags (ShutterCount, BatteryLevel, Lens info, Sony Picture Profile, etc.).
- **`[InteropIFD]`**: `InteropIndex: R98` (DCF basic-file marker) and `InteropVersion: 0100`. **This is critical for DCF recognition.**
- **`[IFD1]`**: thumbnail-related tags (Make, Model, Software, ModifyDate). We had only the bare thumbnail.
- **`[PrintIM]`**: Sony-specific print marker.

### Image dimensions: 1920×1280, not full-res

Cue ships 1920×1280 (~2.5 MP), not the camera's full resolution. Result: ~150–210 KB per file. We were rendering at 3840×2560 (~10 MP) — same file size because text doesn't compress, but unnecessarily large pixel count for something that's just being scrolled on a 3" LCD.

### No `ImageDescription` marker

Cue's cards have **no programmatic identifier** in EXIF. Their `UserComment` is empty, no `ImageDescription`. They've chosen invisibility — to a user inspecting the card in Lightroom, it looks like an ordinary Sony shoot.

We have chosen the **opposite**: every PosingInCam card carries `ImageDescription: posingincam:<pose-id>:v<version>` so users can filter our cards out of imports with one rule. That is a deliberate divergence from Cue.

### DateTime: real recent vs frozen

Cue uses recent timestamps (the day they shipped the pack). Their cards intermix with the user's working photos by date.

We freeze `DateTimeOriginal` to `2000:01:01 00:00:01` so cards sort to one end of the timeline and never visually mix with shoots. That is also a deliberate divergence.

## What we changed in our pipeline

Implemented in this commit:

1. **Added ~30 EXIF tags to `render/exif.py`**: ExifVersion, FlashpixVersion, ComponentsConfiguration, PixelXDimension/PixelYDimension, YCbCrPositioning, basic shooting params (ExposureTime, FNumber, ISO, ExposureProgram, MeteringMode, etc.), scene metadata, lens hints.
2. **Added `[InteropIFD]`** with `InteropIndex: R98` and `InteropVersion: 0100`. This is the DCF "basic file" marker.
3. **Updated `[IFD1]`** (thumbnail IFD) with Make/Model/Software/ModifyDate so it parallels what cameras write.
4. **Reduced default image size for `sony-a7iv` profile** to 1920×1280 to match Cue.
5. **Updated `Software` tag** to camera-firmware-style string by default.

## What we deliberately did NOT change

| Cue's choice | Our choice | Why |
| --- | --- | --- |
| Full Sony MakerNotes blob (~80 tags including ShutterCount, BatteryLevel, etc.) | Skip MakerNotes entirely | Faking Sony's proprietary IFD requires either (a) extracting it from a real shot via `exiftool -tagsFromFile` which adds a binary dependency, or (b) hand-crafting it which is fragile. We bet that Sony A7 IV will accept the file based on the standard EXIF + DCF Interop marker alone. **If hardware test fails, this is the next thing to try.** |
| No `ImageDescription` marker | Always emit `posingincam:<pose-id>:v<version>` | Filterability in Lightroom is a v1 user story (US-05). We trade invisibility for filterability. |
| `DateTimeOriginal` = recent | `DateTimeOriginal` = frozen 2000-01-01 | We trade intermixing for visible separation in playback timeline. |
| Spoof as A7S III | Spoof as actual target body (A7 IV → ILCE-7M4) | A7 IV is our test target. If Sony does Make/Model gating, matching the body makes it more likely to play back. Open question — see ADR 0004. |

## Fallback plan if hardware test still fails after these changes

In priority order:

1. **Try Cue's exact image size** (already done: 1920×1280).
2. **Try Cue's exact Make/Model**: change profile to `ILCE-7SM3` instead of `ILCE-7M4`. We know A7S III spoofing works on at least one Sony body.
3. **Add `--template <real-shot.JPG>` build option** that uses `exiftool -tagsFromFile` to copy Sony MakerNotes from a user-provided real Sony A7 IV shot. This adds an external `exiftool` dependency but gets us 1:1 with Cue's strategy.
4. **Buy a single Cue Pose Pack** for direct A/B test on the actual hardware. (Roughly $40 last seen; cheap as research.)

## Anti-pattern reminder

The Cue sample JPGs cannot be redistributed. We used them for one-time analysis under fair-use ("compatibility testing of an interoperable system"), wrote down what we needed to know, and then removed them from the repo. They are gitignored; don't re-add them.
