# Camera Test Results

This file logs every hardware test we run. Append a section per session — never edit historical entries.

| Field | Value |
| --- | --- |
| **Status** | No tests recorded yet |
| **Last updated** | 2026-05-05 |

## Format

Use this template per session:

```markdown
## <camera-id> — <date>

| Field | Value |
| --- | --- |
| Camera | Sony Alpha 7 IV (sony-a7iv) |
| Firmware | 3.01 |
| Build commit | abc1234 |
| Tester | <name> |
| Card | SanDisk Extreme Pro 64 GB SDXC |
| Profile config | folder=199MSDCF, prefix=DSC0, image=3840×2560, spoof=true |

### Checklist

- [ ] 3.1 Card mounts without complaints
- [ ] 3.2 Single-image view renders full-resolution
- [ ] 3.3 Zoom-in works at 100%
- [ ] 3.4 Grid view shows line-art thumbnail (no text)
- [ ] 3.5 Coexists with new real photos
- [ ] 3.6 Image info shows correct Make/Model/Date
- [ ] 3.7 Screen photos taken

### Notes

(quirks, deviations, surprises)

### Photos

- single view: `docs/camera-tests/sony-a7iv/2026-05-05/single.jpg`
- grid view:   `docs/camera-tests/sony-a7iv/2026-05-05/grid.jpg`
- info view:   `docs/camera-tests/sony-a7iv/2026-05-05/info.jpg`

### Outcome

(pass / partial / fail) — and the reason.
```

---

## Sessions

<!-- Append new sessions below this line. Newest first. -->
