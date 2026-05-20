# Sony JPEG Fingerprint and the Quantization-Table Discovery

> What we learned while making `cardify` work on Sony A7 III with firmware v4.01 — the body Cue.io explicitly does not support.

## Why this document exists

The A7 IV / A7 V playback engines are tolerant: they accept any standards-compliant baseline JPEG that happens to have valid Sony EXIF and DCF naming. For two years the project treated that as "the bar." Adding a third tested body — an A7 III on firmware v4.01 — broke the assumption hard. The same SD card that played back perfectly on A7 IV and A7 V returned **"Unable to display"** on A7 III, regardless of what we did to the EXIF.

After roughly seven hours of structured binary-search debugging, the difference turned out to be at the JPEG bitstream level, not in EXIF. This document writes down everything we ruled out, the actual root cause, and the fix — so the next person who hits the wall (Canon? Nikon? OM System?) has a faster path through it.

## The shape of the problem

The setup:

- The same photographer brought a third Sony body into the test set, an A7 III on firmware v4.01, alongside the already-verified A7 IV and A7 V.
- A clean SOOC JPEG was pulled straight off the A7 III's SD card and used as the cardify template. EXIF/MakerNotes inspection looked clean (Make=SONY, Model=ILCE-7M3, full MakerNotes block, no Photo Mechanic XMP residue).
- Ran `cardify.sh` exactly as we did for A7 IV/V, using this real-camera template.
- Result on the A7 III: **"Unable to display."** Same card on the A7 IV: plays back. Same card on the A7 V: plays back.

## What we tried (and what it cost)

Every step took 5–15 minutes round-trip (modify file on Mac, eject SD, insert in camera, run Recover Image DB, attempt playback, report back). None of the following changed the outcome:

| What we changed | Hypothesis | Outcome |
| --- | --- | --- |
| Custom folder name `101POSES` → standard `100MSDCF` | Sony might filter non-standard folder names | Independently true, but not the cause |
| File prefix `INP` (matching the body's Set File Name at the time) | Sony might filter by current Set File Name | Set File Name does not affect playback visibility |
| EXIF dates pinned to 2024 → reset to today | Sony might validate date freshness | Date not the discriminator |
| `cp` → `cp -p` (preserve mtime/atime) | Sony might validate filesystem timestamps against EXIF | Helped but not sufficient |
| `Menu → Recover Image DB` → manual `rm -rf AVF_INFO/` | Sony's normal rebuild might skip externally-added files | True for v4.01, but only relevant once the file itself passes validation |
| Forced `YCbCrPositioning=1` (Centered) → leave at template's `=2` (Co-sited) | Tag override might break Sony fingerprint | Independently true (Co-sited is correct), but not the cause |
| Added a 1616×1080 `PreviewImage` via exiftool (the MPF Large Thumbnail real Sony files carry) | A7 III might require MPF preview | Did not change the outcome |
| Resized output 1920×1280 → 3008×2000 (A7 III's smallest native JPEG size) | Older firmware might validate against its own native sizes | Dimensions not the discriminator |
| Used the A7 III's own literal SOOC file as the cardify template (instead of a DPReview download) | DPReview samples are sometimes Photo Mechanic-touched | Real-body SOOC is the right template, but using it didn't fix cardify output |

What did work, repeatedly:

| Test | Result |
| --- | --- |
| Bit-identical copy of camera's own SOOC, renamed `cp -p DSC09014.JPG DSC09099.JPG`, AVF_INFO deleted | **Plays back.** |
| Real SOOC with a single EXIF tag edited via exiftool (DateTimeOriginal touched, no pixel re-encode) | **Plays back.** |
| Real SOOC re-encoded by ImageMagick / Pillow at quality 90 baseline 4:2:2 with otherwise-identical Sony EXIF transplanted via `-tagsFromFile -all:all` | **"Unable to display."** |

The signal was unambiguous: **any pixel re-encoding broke A7 III compatibility, even when EXIF/MakerNotes were byte-for-byte identical to a working Sony file.**

## The root cause

Sony A7 III firmware v4.01 validates **the JPEG bitstream itself**, not just the EXIF metadata. The validation appears to fingerprint:

- **DQT (quantization tables)** — Sony's BIONZ X / XR processors emit specific quantization tables that ImageMagick / standard libjpeg do not replicate at any quality setting.
- **DHT (Huffman tables)** — Pillow, when `optimize=True`, regenerates Huffman tables based on image content; the resulting tables don't match Sony's pattern.
- **APP segment ordering and presence** — real Sony JPEGs go `SOI → APP1 (EXIF) → APP2 (MPF)`. ImageMagick and Pillow both insert `APP0 (JFIF)` between SOI and APP1, which no real Sony JPEG ever has.

The A7 IV / A7 V playback engines are tolerant of these deviations — they apparently just look at "is this a baseline JPEG with valid Sony EXIF, sure, render it." A7 III v4.01 is strict: it walks the bitstream structure and rejects anything that doesn't match the fingerprint.

This is the same wall Cue.io appears to have hit. Their published supported-bodies list explicitly excludes A7 III. They presumably could have solved it the way we eventually did, but the work involved would have outweighed the small market segment of A7 III users for them. For an open / DIY pipeline aimed at working photographers (who very much still use A7 III), it's worth solving.

## The fix

Three coordinated changes in `cardify.sh`:

### 1. Encode with the template body's quantization tables verbatim

Pillow exposes a JPEG file's quantization tables on its `.quantization` attribute and accepts a matching `qtables=` parameter on `Image.save()`. The trick is that **`optimize` must be `False`** — otherwise Pillow regenerates Huffman tables to fit the new image, undoing half the fix.

```python
from PIL import Image

template = Image.open(template_path)
qtables = template.quantization                # Dict {0: array, 1: array}
img = Image.open(input_path).convert("RGB")
img = img.resize((width, height), Image.LANCZOS)
img.save(output_path, "JPEG",
         qtables=qtables,
         subsampling=1,        # 4:2:2
         progressive=False,
         optimize=False)
```

This produces a JPEG whose DQT and DHT segments match what a real Sony body would have written for an image of the same dimensions at similar content complexity. Sony's firmware-level fingerprint check passes.

### 2. Strip the JFIF / APP0 segment after encoding

Both Pillow and ImageMagick write an APP0 JFIF marker unconditionally. Real Sony JPEGs have no APP0 — they start `SOI → APP1`. ExifTool can remove the JFIF group cleanly:

```bash
exiftool -overwrite_original -JFIF:all= "$OUTPUT"
```

This drops the unexpected APP0 segment without disturbing APP1 (EXIF) or anything downstream.

### 3. Match Sony's `YCbCrPositioning = 2 (Co-sited)`

Earlier versions of `cardify.sh` forced `YCbCrPositioning=1` (Centered) on the theory that "more compatible." Real Sony JPEGs ship `=2` (Co-sited) without exception. A7 IV/V tolerate either; A7 III rejects the mismatch.

```bash
exiftool -overwrite_original -n "-YCbCrPositioning=2" "$OUTPUT"
```

## What the customer side still needs

The encode fix is necessary but not sufficient — the SD card side has its own quirks:

1. **Files must go into a standard `DCIM/<NNN>MSDCF/` folder.** A custom folder like `101POSES` looks valid per DCF, but Sony's playback engine silently filters anything whose suffix is not `MSDCF` on the bodies we tested.
2. **The copy step has to preserve filesystem timestamps**, i.e. `cp -p` rather than plain `cp`. Older firmwares appear to do a sanity check between filesystem `mtime` and EXIF `DateTimeOriginal`; the cardify pipeline pins both, and `cp -p` keeps them aligned across the SD write.
3. **On insertion, the camera must perform a full image-database rebuild**, not a Recover-Image-DB-from-existing-index update. The simplest way to force the right kind of rebuild is to delete the entire `AVF_INFO/` folder on the SD before insertion. The camera then prompts "Recover image database?" and starts from zero, validating each file against its fingerprint check. Files that pass go into the new index; files that fail don't, and won't appear in playback. With cardify v3+ output, every file passes.

## The universal-compatibility finding

Once cardify could produce A7 III-acceptable output, the same SD card with the same files was tested on A7 IV and A7 V — both played back perfectly. **One file works on all three bodies.**

The implication is mechanical: the oldest body in a vendor's current lineup has the strictest JPEG validator. A file that satisfies it satisfies every newer body in the same lineage, because newer bodies are tolerant supersets. This collapses what looked like a per-model template matrix (10+ Sony SKUs) into a single Sony SKU, sourced from the oldest popular wedding-shooting body.

## Sourcing rule for new vendors

Generalizing from the Sony lesson:

1. **Identify the oldest popular wedding-shooting body** in the target vendor's current lineup. For Canon, that's likely R5 or R6. For Nikon, Z6 II or Z7 II. For Fuji, X-T4 or X-T5.
2. **Get one real SOOC JPEG from that body** — straight off the camera's own SD card, not a re-export, not a download from a sample gallery (DPReview samples are Photo-Mechanic-touched and unreliable; verified empirically for A7 III).
3. **Build the first card with that template, hardware-test on the source body itself**, then on every newer body in the same lineup. The oldest is the strict validator; if it passes, the rest will.

If a vendor's older firmware turns out to be even stricter than what we've seen on Sony (e.g. Canon firmware fingerprinting DRI markers or specific DHT entropy distributions), the q-table extraction approach is still the right first attempt — it produced a Sony-grade fingerprint without any model-specific reverse engineering, and it should generalize.

## What this is not

A few honest disclaimers about scope:

- **This is not a perpetually stable solution.** A Sony firmware update could tighten the fingerprint check further (e.g. validate Huffman table entropy as well as structure, or require specific MPF preview byte offsets). If that happens, A7 III may stop working on some future firmware release and we'd need a deeper approach (custom libjpeg with Sony quantization profiles, or Wi-Fi push via Sony Creator's App API to bypass SD-card-level validation entirely).
- **It does not extend automatically to Canon or Nikon.** We have an empirical method (q-table extraction + format-specific quirks), not a universal solver. Each new vendor will need its own template-and-test cycle, and may reveal vendor-specific quirks (DRI presence, APP14 Adobe marker handling, custom DPOF data).
- **It does not work on a re-export of a re-export.** Files that have been through Photo Mechanic, Lightroom, Photoshop, iCloud Photos compression, WhatsApp, or any other image processor will have lost or modified the quantization tables. The template must be straight from the camera's SD card.

## Where to go next

- `scripts/cardify.sh` — current implementation
- `docs/CAMERA_TEST_RESULTS.md` (2026-05-20 session) — empirical log
- `docs/M2_HARDWARE_TEST.md` — triage / repro protocol
- `samples/sony-a7iv/DSC00099.JPG` — pre-built reference card, hardware-confirmed working

For anyone extending to a new vendor: read this doc, follow the sourcing rule, encode via the q-table technique, and update `docs/CAMERA_TEST_RESULTS.md` with every body you confirm.
