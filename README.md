# PosingInCam

> Pose reference cards on the back of your camera. No phone. No fumble. No "let me check Pinterest real quick."

Design pose cards your way (Canva, Figma, Photoshop — whatever), run them through one shell script, drop the result on your SD card, and they show up in your camera's playback alongside your real photos. Scroll between shots; no phone reach.

```
Canva design  ──►  cardify.sh  ──►  DSC09000.JPG  ──►  SD card  ──►  Camera playback
   (any size)        (one cmd)        (Sony-spec)
```

Built for working photographers. Hardware-verified on **Sony A7-series, Canon EOS R, and Nikon Z** bodies; other bodies welcome — see [Camera Compatibility](docs/CAMERA_COMPATIBILITY.md).

---

## Why this exists

Pulling out your phone mid-shoot to check a pose has three costs: trust erosion (the bride sees you scrolling), pace breakage (20–60 s per pose lookup), and brittleness (dead phone, gloves, sun glare, no signal). [Cue (shootwithcue.com)](https://www.shootwithcue.com) demonstrated that the obvious-in-hindsight solution is to ship the references as JPEGs the camera plays back natively. This repo is an open, scriptable equivalent: bring your own card design, get a Sony-spec JPEG out.

---

## Quick start

### Prerequisites (one-time)

```bash
brew install exiftool                # mandatory: EXIF/MakerNotes manipulation
pip3 install Pillow                  # mandatory: JPEG encoding with Sony q-tables
```

Why Pillow over ImageMagick: older Sony bodies (A7 III v4.01 and similar BIONZ X bodies) reject JPEGs encoded with standard libjpeg quantization tables. Pillow lets us reuse the camera template's exact tables, unlocking those bodies. ImageMagick is no longer used.

### Get the script

Copy [`scripts/cardify.sh`](scripts/cardify.sh) to your Desktop (or anywhere on `$PATH`) and `chmod +x` it.

### Get a template JPEG

Take **one** ordinary photo with your Sony body and copy it off the SD card. We use it as an EXIF template — its Make/Model/MakerNotes get transplanted onto your card so the camera treats the result as a native shot. Save it as `template.JPG`.

### Make a card

1. Design in Canva/Figma/Photoshop. Any size; portrait or landscape both fine.
2. Export as JPEG.
3. Run:

```bash
./cardify.sh -p template.JPG mycard.jpg DSC09000.JPG    # -p portrait
# or
./cardify.sh -l template.JPG mycard.jpg DSC09001.JPG    # -l landscape
# or
./cardify.sh    template.JPG mycard.jpg DSC09002.JPG    # auto-detect
```

The output is a Sony-spec JPEG: `1920×1280` pixels, baseline DCT, YCbCr 4:2:2, EXIF `Orientation` set so the camera auto-rotates correctly when you turn the body, full Sony Make/Model/MakerNotes copied from the template, R98 DCF marker, embedded thumbnail.

#### Why `DSC09NNN` and not `DSC00099`?

Sony cameras pick the next file number as `max_existing + 1`. If you place a card at `DSC00099.JPG` on a card that already has the photographer's shots up to `DSC00050`, their next shot becomes `DSC00100`, not `00051` — confusing. Using the high `9NNN` range (e.g. `DSC09000`–`DSC09029` for a 30-card pack) keeps the photographer's daily numbering in the `0NNN`–`8NNN` range untouched for years of normal shooting. The cards also pin `DateTimeOriginal` to `2024:01:01` so Date View separates them from current shoots automatically.

### Drop on SD card

Format the card in the camera once, take one normal photo (creates `DCIM/100MSDCF/`), then on your computer drop your `DSC09000.JPG` into that folder. Eject cleanly. Insert in camera. Hit playback.

Detailed walkthrough: [docs/M2_HARDWARE_TEST.md](docs/M2_HARDWARE_TEST.md).

---

## What the script does

1. Re-encodes your input as **baseline JPEG with YCbCr 4:2:2** (cameras reject progressive JPEGs and some firmwares reject 4:2:0).
2. Forces dimensions to **1920×1280** (multiples of 16, the JPEG MCU block size). Real Sony portrait shots are stored as landscape pixels with the rotation handled by the EXIF `Orientation` tag — we follow the same convention.
3. **Copies all EXIF tags** from your template (Make, Model, MakerNotes, …).
4. **Strips template-specific stuff** (the template's thumbnail, dimensions, ICC profile, XMP, IPTC).
5. **Pins date to `2024:01:01 12:00:00`** so cards don't collide with your real shoots in Date View.
6. Writes the **R98 DCF basic-file marker** (some Sony firmwares gate playback on this).
7. Generates a fresh **160-px thumbnail** from your card and embeds it.
8. **Post-encode validation gate** — re-reads the output and aborts if any required tag is missing or wrong. If the script exits 0, the file is verified spec-compliant.

See [docs/CUE_EXIF_ANALYSIS.md](docs/CUE_EXIF_ANALYSIS.md) for the reasoning, including the EXIF teardown of Cue's reference samples that informed every step.

### Diagnosing failed cards

If a card doesn't play back on a camera, run the validator on the suspect file:

```bash
./cardify.sh --validate suspect.JPG
```

It returns 0 if the file is spec-compliant (so the problem is camera-side — see [Triage](docs/M2_HARDWARE_TEST.md#5-triage--what-to-do-when-something-fails), most commonly "Recover Image Database" on the camera menu), or 1 with a list of which checks failed (so the file needs to be regenerated).

---

## Repository layout

```
.
├── scripts/
│   ├── cardify.sh        ← main tool: Canva JPEG → camera-ready JPEG
│   └── exif_diff.py      ← debug: side-by-side EXIF diff vs a reference shot
├── samples/
│   └── sony-a7iv/        ← pre-built example output, downloadable from GitHub
├── docs/
│   ├── M2_HARDWARE_TEST.md     ← step-by-step Sony A7 IV verification
│   ├── CAMERA_COMPATIBILITY.md ← per-vendor folder/file conventions
│   ├── CAMERA_TEST_RESULTS.md  ← log of confirmed-working bodies
│   └── CUE_EXIF_ANALYSIS.md    ← EXIF reverse-engineering notes
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── LICENSE
```

---

## Status

Hardware-verified on real bodies (portrait + landscape, auto-rotation correct, full playback + zoom + grid view):

| Body | Status | Template used |
| --- | --- | --- |
| **Sony A7 III** (firmware v4.01) | ✓ Verified | A7 III SOOC |
| **Sony A7 IV** | ✓ Verified | A7 III SOOC (same file) |
| **Sony A7 V** | ✓ Verified | A7 III SOOC (same file) |
| **Canon EOS R6 Mark II** | ✓ Verified | R6 Mark II SOOC (same body) |
| **Canon EOS R6 Mark III** | ✓ Verified (cross-body) | R6 Mark II SOOC template played back on a different friend's R6 Mark III body |
| **Nikon Z8** | ✓ Verified (cross-body) | Z6 III SOOC template |
| **Nikon Z9** | ✓ Verified (cross-body) | Z6 III SOOC template (same file as Z8) |
| Other Sony Alpha (A7R V, A1, A1 II, A9 III, A7C II, A7S III, …) | Should work | Same Sony template expected to apply |
| Other Canon EOS R (R5, R5 Mark II, R6, R5 Mark III, …) | Likely works | R6 line cross-body confirmed; R5 line untested on hardware but expected to follow the same pattern |
| Other Nikon Z (Z6 III, Z6 II, Z7 II, Zf, Z5, …) | Likely works | Z8 / Z9 cross-body confirmed; rest untested on hardware but expected to follow the same pattern |
| Fujifilm / OM System | Not yet supported | Cardify vendor switch needs an additional case |

### One file, every supported Sony body

**A single cardified JPEG, encoded with quantization tables from a Sony A7 III, plays back correctly on all three tested bodies (A7 III, A7 IV, A7 V) from one shared SD card with zero per-model adjustment.** This is the key strategic finding from hardware testing:

- The **oldest supported body has the strictest JPEG validator**. A7 III v4.01 rejects standard libjpeg/ImageMagick output as "Unable to display"; it accepts only files whose JPEG structure matches a real Sony fingerprint.
- The **newer bodies (A7 IV, A7 V) are tolerant** — they accept anything the strict validator passes, and more.
- Therefore: **a file built to satisfy the oldest body works on every newer body in the same lineage**. One template, one output, every Sony Alpha (within the BIONZ X / XR ecosystem).

This collapses what was looking like a per-model template matrix (10+ Sony SKUs) into a single Sony SKU — sourced from the oldest popular wedding-shooting body in each vendor's line.

### Why the older Sony A7 III needs special handling

Sony A7 IV / A7 V playback engines accept any standards-compliant baseline JPEG, so cardify worked fine on them with the old ImageMagick-based pipeline. **Sony A7 III with firmware v4.01 (and likely other older Sony bodies)** validates a JPEG "fingerprint" — quantization tables, Huffman tables, and APP-segment structure must match what a real Sony camera produces. ImageMagick/libjpeg output fails this check.

The current pipeline encodes via **Pillow with the template body's exact quantization tables** (`Image.save(..., qtables=template.quantization, optimize=False)`), producing output that's structurally indistinguishable from a real Sony JPEG. This unblocks A7 III playback, hardware-verified — and as the universal-compatibility finding above shows, the same output also satisfies every newer Sony body.

This is the same wall Cue.io hit when they decided not to support A7 III — and we're past it.

### Sourcing strategy (extrapolated to other vendors)

The universal-compatibility finding on Sony suggests this rule for adding any new vendor:

1. **Pick the oldest popular wedding-shooting body in that vendor's current lineup** (e.g. Canon R5 / R6 for Canon, Nikon Z6 II / Z7 II for Nikon, Fuji X-T4 / X-T5 for Fuji).
2. **Source one real SOOC JPEG from that body** as the template.
3. **Build and test cards on that body first** — it'll be the strictest validator.
4. **Newer bodies in the same lineage should work without further changes**, pending hardware verification.

**Canon status (as of 2026-05-21):** Canon EOS R6 Mark II hardware-verified with its own SOOC as the template (2026-05-20). The next day a different friend's R6 Mark III played back the same R6 Mark II-templated card without modification — cross-body Canon verification, firm. The R6 line therefore collapses to one Canon template (the older R6 Mark II SOOC), same shape as the Sony A7 III template covering A7 IV / V. The R5 line remains untested but is expected to follow the same pattern.

**Nikon status (as of 2026-05-31):** Nikon Z8 and Z9 both hardware-verified, cross-body, from a single clean Nikon Z6 III SOOC template — a friend placed the same pack on both pro bodies and every reference played back natively. The Nikon Z line therefore collapses to one template, same shape as Sony and Canon. One Nikon wrinkle: the DCF folder name encodes the body (`100NCZ_8` on a Z8, `100NCZ_9` on a Z9, `100NCZ_6` / `100NCZ_7` on the Z6 / Z7 lines) rather than being a single fixed folder, so the customer copies the pack into whichever `100NCZ_…` folder their own body created. Going to production.

This confirms **three SKUs (Sony / Canon / Nikon)** are enough to cover the working-photographer market — one template per vendor, all three now hardware-verified cross-body.

---

## License

MIT — see [LICENSE](LICENSE).
