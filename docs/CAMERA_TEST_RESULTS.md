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
