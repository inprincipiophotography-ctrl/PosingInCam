# PosingInCam

> Pose reference cards on the back of your camera. No phone. No fumble. No "let me check Pinterest real quick."

Design pose cards your way (Canva, Figma, Photoshop — whatever), run them through one shell script, drop the result on your SD card, and they show up in your camera's playback alongside your real photos. Scroll between shots; no phone reach.

```
Canva design  ──►  cardify.sh  ──►  DSC00099.JPG  ──►  SD card  ──►  Camera playback
   (any size)        (one cmd)        (Sony-spec)
```

Built for working photographers. Currently focused on **Sony A7-series**; other bodies welcome — see [Camera Compatibility](docs/CAMERA_COMPATIBILITY.md).

---

## Why this exists

Pulling out your phone mid-shoot to check a pose has three costs: trust erosion (the bride sees you scrolling), pace breakage (20–60 s per pose lookup), and brittleness (dead phone, gloves, sun glare, no signal). [Cue (shootwithcue.com)](https://www.shootwithcue.com) demonstrated that the obvious-in-hindsight solution is to ship the references as JPEGs the camera plays back natively. This repo is an open, scriptable equivalent: bring your own card design, get a Sony-spec JPEG out.

---

## Quick start

### Prerequisites (one-time)

```bash
brew install exiftool imagemagick   # exiftool is mandatory; imagemagick is recommended
```

### Get the script

Copy [`scripts/cardify.sh`](scripts/cardify.sh) to your Desktop (or anywhere on `$PATH`) and `chmod +x` it.

### Get a template JPEG

Take **one** ordinary photo with your Sony body and copy it off the SD card. We use it as an EXIF template — its Make/Model/MakerNotes get transplanted onto your card so the camera treats the result as a native shot. Save it as `template.JPG`.

### Make a card

1. Design in Canva/Figma/Photoshop. Any size; portrait or landscape both fine.
2. Export as JPEG.
3. Run:

```bash
./cardify.sh -p template.JPG mycard.jpg DSC00099.JPG    # -p portrait
# or
./cardify.sh -l template.JPG mycard.jpg DSC00100.JPG    # -l landscape
# or
./cardify.sh    template.JPG mycard.jpg DSC00101.JPG    # auto-detect
```

The output is a Sony-spec JPEG: `1920×1280` pixels, baseline DCT, YCbCr 4:2:2, EXIF `Orientation` set so the camera auto-rotates correctly when you turn the body, full Sony Make/Model/MakerNotes copied from the template, R98 DCF marker, embedded thumbnail.

### Drop on SD card

Format the card in the camera once, take one normal photo (creates `DCIM/100MSDCF/`), then on your computer drop your `DSC00099.JPG` into that folder. Eject cleanly. Insert in camera. Hit playback.

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

| | |
| --- | --- |
| **Sony A7 IV** | Confirmed working (portrait + landscape; auto-rotation correct) |
| **Other Sony A7-series** | Should work — same EXIF + DCF conventions. Untested. |
| **Canon EOS R / Nikon Z / Fujifilm / Panasonic** | Different folder/file conventions; same idea but the script needs minor edits per vendor. See [Camera Compatibility](docs/CAMERA_COMPATIBILITY.md) and the issue tracker. |

---

## License

MIT — see [LICENSE](LICENSE).
