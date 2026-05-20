# Camera Test Results

Log of hardware tests. Append-only — never edit historical entries.

## Format

Use this template per session:

```markdown
## <camera> — <date>

| Field | Value |
| --- | --- |
| Body         | Sony Alpha 7 IV |
| Firmware     | 3.01 |
| Tester       | <name> |
| Card         | SanDisk Extreme Pro 64 GB SDXC |
| Output spec  | 1920×1280, baseline, 4:2:2, Orientation=6 |

### Checklist (from docs/M2_HARDWARE_TEST.md §4)

- [ ] 4.1 Card mounts without complaints
- [ ] 4.2 Single-image view renders full-resolution
- [ ] 4.3 Zoom works at 100%
- [ ] 4.4 Grid view shows the line-art thumbnail
- [ ] 4.5 Auto-rotation correct (portrait + landscape)
- [ ] 4.6 Coexists with real photos taken later
- [ ] 4.7 Image info shows correct Make/Model
- [ ] 4.8 Screen photos taken

### Notes

(quirks, deviations, surprises)

### Photos

- single view: `docs/camera-tests/<body>/<date>/single.jpg`
- grid view:   `docs/camera-tests/<body>/<date>/grid.jpg`

### Outcome

pass / partial / fail — and the reason.
```

---

## Sessions

<!-- Append new sessions below this line. Newest first. -->

## Sony A7 III / A7 IV / A7 V — 2026-05-20 (universal compatibility test)

| Field | Value |
| --- | --- |
| Bodies tested | Sony A7 III (firmware v4.01), Sony A7 IV, Sony A7 V |
| Tester        | inprincipiophotography-ctrl |
| Template used | Single A7 III SOOC JPEG (`DSC09014.JPG`, ILCE-7M3 v4.01) |
| Output spec   | 1920×1280, baseline, YCbCr 4:2:2, Sony q-tables from template, no JFIF, YCbCrPositioning=2 (Co-sited), Orientation=6 (portrait) |
| SD workflow   | `cp -p` into `DCIM/100MSDCF/`, optional `rm -rf AVF_INFO/`, eject, insert, accept Recover Image Database prompt |

### Checklist (A7 III, A7 IV, A7 V — same SD card, same output file)

- [x] 4.1 Card mounts without complaints on all three bodies
- [x] 4.2 Single-image view renders full-resolution on all three
- [x] 4.3 Zoom works at 100% on all three
- [x] 4.4 Grid view shows thumbnail correctly on all three
- [x] 4.5 Auto-rotation correct (portrait + landscape)
- [x] 4.6 Coexists with real photos taken in the same session
- [x] 4.7 Image info shows correct Make/Model (SONY / ILCE-7M3 — i.e., the template body, not the playback body)
- [x] Universal portability: one SD card, one output file, three different camera bodies, no per-model adjustment

### Notes

This session confirms the **universal compatibility hypothesis**: a JPEG encoded with the quantization tables of the oldest-supported Sony body (here, A7 III with firmware v4.01 — the strictest validator) plays back natively on every newer Sony body in the same lineage. The strict validator accepts the file; the more permissive newer bodies also accept it. No per-model template required.

### Breakthrough — what unblocked A7 III

A7 III v4.01 firmware validates the JPEG bitstream against a Sony-specific fingerprint (quantization tables, Huffman tables, APP-segment structure). It rejects ImageMagick / standard libjpeg output as "Unable to display" even when EXIF, MakerNotes, file naming, folder, and timestamps are all correct. The fix:

1. **Encode via Pillow with the template's quantization tables verbatim** (`Image.save(..., qtables=template.quantization, optimize=False)`). `optimize=False` is critical — it prevents Pillow from regenerating Huffman tables that would also break the fingerprint.
2. **Strip the JFIF/APP0 segment** that Pillow/ImageMagick automatically add but real Sony JPEGs lack.
3. **Set YCbCrPositioning to 2 (Co-sited)**, matching native Sony output (the previous `=1` Centered value worked on A7 IV/V but failed on A7 III).
4. **On the customer side**, deleting `AVF_INFO/` before card insertion forces a full image-database rebuild on the camera, which validates and indexes the new files cleanly. Without the deletion, A7 III's Recover Image DB only updates existing entries and may not pick up manually-added files.

### Outcome

**pass on all three bodies from one SD card with zero per-model adjustment.** This is the same wall Cue.io hit when they decided not to support A7 III (their supported list explicitly excludes it). We're past it. Per-vendor sourcing strategy now collapses to one template per vendor, sourced from the oldest popular wedding-shooting body in that vendor's lineup.

---

## Sony A7 IV — 2026-05-07

| Field | Value |
| --- | --- |
| Body         | Sony Alpha 7 IV |
| Tester       | inprincipiophotography-ctrl |
| Output spec  | 1920×1280, baseline, YCbCr 4:2:2, EXIF copied from real A7 IV template, R98 marker, Orientation=6 (portrait) / 1 (landscape) |

### Checklist

- [x] 4.1 Card mounts without complaints
- [x] 4.2 Single-image view renders full-resolution
- [x] 4.3 Zoom works at 100%
- [x] 4.4 Grid view shows the line-art thumbnail
- [x] 4.5 Auto-rotation correct (portrait + landscape)
- [x] 4.6 Coexists with real photos
- [x] 4.7 Image info shows correct Make/Model

### Outcome

**pass.** `cardify.sh` produces playback-compatible JPEGs on the Sony A7 IV. Both portrait and landscape orientations rotate correctly when the camera body is turned.
