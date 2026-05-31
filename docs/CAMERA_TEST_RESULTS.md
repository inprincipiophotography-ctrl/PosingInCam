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

## Nikon Z8 / Z9 — 2026-05-31 (first Nikon hardware verification, cross-body)

| Field | Value |
| --- | --- |
| Bodies tested | Nikon Z8 and Nikon Z9 (friend-owned; serials / firmware not recorded) |
| Tester        | inprincipiophotography-ctrl + friend |
| Template used | **Nikon Z6 III SOOC** (`NIKON-SOOC.JPG`, Model `NIKON Z6_3`, firmware Ver.02.00) — clean out-of-camera JPEG, sRGB, R98 DCF marker, ColorSpace=1, no Photo Mechanic touch. |
| File(s) sent  | Cardify output built from the Z6 III template (Canva pose design + Z6 III q-tables + Nikon MakerNotes via `exiftool -tagsFromFile -all:all`), named `DSC_xxxx.JPG`. The **same files** were placed on both bodies' cards. |
| Output spec   | 1920×1280, baseline, YCbCr 4:2:2, Z6 III q-tables, no JFIF, YCbCrPositioning=2 (Co-sited), Make=`NIKON CORPORATION`, Model=`NIKON Z6_3` in EXIF (carried from template). |
| DCF folder    | Body-specific: files copied into each body's own first folder (`100NCZ_8` on the Z8, `100NCZ_9` on the Z9). |
| Hardware result | Played back correctly on both the Z8 and the Z9; every reference shown, no error, full playback. Friend reported "works as it should" on both bodies. |

### What this confirms

**A single Nikon Z template covers the pro Z line cross-body.** One clean Z6 III SOOC produces output that plays back on both a Z8 and a Z9 with no per-body adjustment — the same one-template-per-vendor-lineage pattern already confirmed on Sony (A7 III → IV / V) and Canon (R6 Mark II → R6 Mark III).

Note the template body here (Z6 III) is *not* the oldest of the three — unlike Sony/Canon, where we deliberately sourced the oldest body as the strictest validator, the Nikon template was simply the clean SOOC we had on hand. It still works cross-body on the older Z8 and Z9, which reinforces that modern Nikon Z playback engines are tolerant of a well-formed Z-series JPEG fingerprint (the strict-validator problem was specific to the older Sony A7 III firmware).

The only Nikon-specific wrinkle is the **DCF folder name, which encodes the body** (`100NCZ_8`, `100NCZ_9`, `100NCZ_6`, `100NCZ_7`, …) rather than being a single fixed folder like Sony's `100MSDCF` or Canon's `100CANON`. The customer copies the pack into whichever `100NCZ_…` folder their own body created; this is called out explicitly in the Nikon customer guide.

### Outcome

**pass on both bodies.** Cross-body Nikon verification, firm. Treat Nikon Z as a single SKU; the Z6 III SOOC (`NIKON-SOOC.JPG`) is the master template for the line. Going to production.

---

## Canon EOS R6 Mark III — 2026-05-21 (Canon cross-body verification)

| Field | Value |
| --- | --- |
| Body          | Canon EOS R6 Mark III (friend-owned; serial / firmware not recorded) |
| Tester        | inprincipiophotography-ctrl + friend |
| Template used | **Zlatkov R6 Mark II SOOC** (`0A0A3799.JPG`) — same template that successfully played back on Zlatkov's R6 Mark II body the previous day. |
| File sent     | `0A0A4000.JPG` — the cardify output built from Zlatkov's template (Contact Info Canva design + R6m2 q-tables + R6m2 MakerNotes via `exiftool -tagsFromFile`). Reconstructed from chat history: only two Canon cardify outputs ever lived on the maintainer's Desktop in this session, and `0A0A4000.JPG` is the one matching the maintainer's "Zlatkov file" recollection. |
| Output spec   | 1920×1280, baseline, YCbCr 4:2:2, R6 Mark II q-tables, no JFIF, YCbCrPositioning=2 (Co-sited), Make=Canon, Model=Canon EOS R6m2 in EXIF (carried from template). |
| Hardware result | Played back correctly on the R6 Mark III body; no error reported. |

### What this confirms

**A single Canon template covers the EOS R6 line across generations.** Zlatkov's R6 Mark II SOOC produces output that plays back on both R6 Mark II (the original body) and R6 Mark III (different friend's body) without any per-body adjustment. Same pattern as the Sony A7 III template covering A7 III / IV / V.

Combined with the R6 Mark II same-body verification from 2026-05-20, the Canon EOS R6 line collapses to **one Canon template**, sourced from the oldest body in the line (R6 Mark II) — matching the older-is-stricter-validator pattern established on Sony.

### Outcome

**pass.** Cross-body Canon verification, firm. Treat Canon EOS R6 as a single SKU; the R6 Mark II SOOC is the master template for the line.

---

## Canon EOS R6 Mark II — 2026-05-20 (first Canon hardware verification)

| Field | Value |
| --- | --- |
| Body          | Canon EOS R6 Mark II (serial 052220000100, Zlatko Zalec) |
| Tester        | inprincipiophotography-ctrl + friend |
| Template used | Same body's own SOOC (`0A0A3799.JPG`) — real working photographer's camera, fresh shot from this session, no Photo Mechanic touch (only `XMP:Rating=0`) |
| Lens          | EF 50mm f/1.4 USM via EF→RF adapter (irrelevant to playback, recorded for context) |
| Output spec   | 1920×1280, baseline, YCbCr 4:2:2, template q-tables, no JFIF, YCbCrPositioning=2 (Co-sited) |
| Output filename | `0A0A4000.JPG` (the body's File Number prefix is `0A0A`, set by the photographer; we matched it for the test) |
| SD workflow   | `cp -p` into `DCIM/100CANON/`, eject cleanly, insert in camera, press Playback |

### Checklist (Canon R6 Mark II)

- [x] Card mounts without complaints
- [x] Single-image view renders the pose reference at full resolution
- [x] No "Cannot display" / corrupted-image error
- [x] Coexists with the photographer's existing photos in the same folder
- [x] Make/Model in image info shows as `Canon EOS R6m2` (matches template)

### Notes

This is the project's first hardware-verified Canon body. The cardify v3
multi-vendor pipeline produced the output unchanged from the Sony path
(Pillow + template q-tables, JFIF stripped, YCbCrPositioning=2, baseline
4:2:2, MakerNotes copied via `exiftool -tagsFromFile -all:all`). Only the
vendor-aware validation regex differs at runtime, and the customer-facing
DCF folder is `100CANON` instead of `100MSDCF`.

Filename prefix observation: the photographer had set Canon's File Number
to a custom 4-character prefix (`0A0A`) rather than the default `IMG_`.
DCF accepts any 4-char prefix, so we matched it (`0A0A4000.JPG`). We did
not test whether the default `IMG_` prefix would have been filtered by
this body's playback engine — based on the Sony A7 III lesson (where we
initially blamed prefix filtering and later traced the real cause to JPEG
fingerprint validation), prefix probably doesn't matter once the JPEG
itself passes the encoder fingerprint check.

### What this confirms

- The cardify v3 pipeline works end-to-end on Canon EOS bodies, not only
  Sony Alpha. The Sony q-tables approach generalises to Canon q-tables
  without any code change — vendor detection picks the right tables from
  the template, encoding stays identical.
- A real-photographer SOOC works as a Canon template. We have not yet
  tested whether a DPReview "clean" Canon sample (R5 Mark II, the only
  one of five DPReview Canon samples that was not Photo-Mechanic-touched)
  works as a cross-body template — see Pending below.

### Pending follow-up

- Cross-body Canon test: rebuild with the DPReview R5 Mark II template
  (`6220180230.jpg`) as input, output named `0A0A4001.JPG` to match this
  body's prefix, place on the same SD card, and confirm whether it plays
  back. If yes, the Sony "one template per vendor lineage" finding
  extends to Canon and we collapse the Canon SKU to a single template.
  If no, Canon requires per-body templates (Canon R5 / R6 / R5m2 / R6m2 /
  R6 Mark III each sourced individually).
- Other Canon bodies (R5, R6 originals, R5 Mark II hardware, R6 Mark III)
  remain untested. The R6 Mark II is the entry point; the rest follow
  the same pattern once a body is available.

### Outcome

**pass.** Canon EOS R6 Mark II playback works with cardify v3 output
built from the same body's SOOC template, hardware-confirmed.

---

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
