# Hardware Test — Sony A7 IV

> Goal: confirm a real Sony A7 IV plays back JPEGs produced by `cardify.sh` in single-image view, in grid view (showing the line-art thumbnail), and at full zoom.

This is the protocol we used to validate the script on real hardware. It applies as-written to any Sony A7-series body and adapts trivially to other vendors.

Time budget: 30–60 minutes if it works first time, 2–3 hours if you have to iterate on EXIF.

---

## 0. What you need

- Sony A7 IV body, charged.
- One SD card you don't mind reformatting.
- USB SD card reader (or a card slot on your laptop).
- A laptop with `exiftool` installed: `brew install exiftool` / `apt install libimage-exiftool-perl`.
- Recommended: `imagemagick` (`brew install imagemagick`) for `cardify.sh`.
- 5–10 minutes of access to a real, recent photo from the same A7 IV — used as the EXIF template.

Optional but recommended: a phone camera or a second photographer to take photos of the camera's screen for the result archive.

---

## 1. Pre-flight

### Note your firmware

```
Camera menu → Setup → Setup Option → Version
```

Write it down — different firmwares behave differently.

### Format the card *in the camera*

Not on the laptop. The camera writes its filesystem skeleton on first format.

```
Menu → Setup → Media → Format
```

Choose your slot, confirm.

### Take 1–2 real photos

Take two normal photos with the camera onto the freshly formatted card. This confirms the card is healthy and gives you the **EXIF template** the script needs.

Eject the card and read it on your laptop:

```
DCIM/100MSDCF/DSC00001.JPG
DCIM/100MSDCF/DSC00002.JPG
```

Copy `DSC00001.JPG` to your laptop as `template.JPG`. Note: the exact folder name (likely `100MSDCF`) and file pattern (`DSC0NNNN.JPG`).

If they differ from `100MSDCF` / `DSC0`, you'll need to edit `cardify.sh` accordingly — see [CAMERA_COMPATIBILITY.md](CAMERA_COMPATIBILITY.md).

---

## 2. Build a card

Design something in Canva (or anywhere). Export as JPEG; size doesn't matter, the script forces 1920×1280.

```bash
./cardify.sh -p template.JPG mycard.jpg DSC00099.JPG
```

You should see:

```
  encoder: imagemagick
  orientation: portrait (file 1920x1280, EXIF Orientation=6)
  1/7 re-encoding (baseline, 4:2:2, q90)...
  2/7 copying Sony EXIF from template...
  3/7 stripping template-specific + extra metadata...
  4/7 writing dimensions 1920x1280 into EXIF...
  5/7 setting fixed safe date (2024:01:01 12:00:00)...
  6/7 forcing DCF marker (R98) + Orientation=6...
  7/7 generating + embedding thumbnail...

  post-encode validation:
  ✓ Make: SONY
  ✓ Model: ILCE-7M4
  ✓ Encoding: Baseline DCT, Huffman coding
  ✓ DCF marker: R98 - DCF basic file (sRGB)
  ✓ Exif width: 1920
  ✓ Exif height: 1280
  ✓ Subsampling: YCbCr4:2:2 (2 1)
  ✓ Orientation: 6
  ✓ Thumbnail: 2400 bytes

✓ DSC00099.JPG (1920×1280, ~250 KB)
  Encoding:    Baseline DCT, Huffman coding
  Subsampling: YCbCr4:2:2 (2 1)
  Make/Model:  SONY / ILCE-7M4
  Orientation: Rotate 90 CW
  DCF marker:  R98 - DCF basic file (sRGB)
```

The post-encode validation block is the safety net — if any `✗` appears there, the script aborts and refuses to ship the file.

Use `-l` for landscape cards instead of `-p`.

---

## 3. Copy to the card

```bash
ls /Volumes/                              # find your SD card mount
cp DSC00099.JPG /Volumes/<your-sd>/DCIM/100MSDCF/
```

**Eject cleanly** through Finder (cmd+E or the eject button next to the card name in the sidebar). Don't yank the card — Sony is touchy about half-written FAT entries.

---

## 4. On-camera verification

Insert the card. Switch to playback mode (▶ button). Run this checklist in order. Mark each ✓ / ✗ — write directly into [CAMERA_TEST_RESULTS.md](CAMERA_TEST_RESULTS.md).

### 4.1 Card mounts cleanly

- [ ] No "recover database" / "rebuild database" prompt.
- [ ] No "no images" / "cannot read card" message.

If the camera asks to rebuild the image database, let it run. Note it.

### 4.2 Single-image view

Scroll through playback to your card.

- [ ] Card appears at full resolution. Not a placeholder, not a "?".
- [ ] Title and body text are sharp.
- [ ] Illustration (if any) renders clean.

### 4.3 Zoom in

Hit the zoom-in button (top wheel, right) and step in to ~100%.

- [ ] Zoom works.
- [ ] At max zoom, body text is sharp.
- [ ] Pan around with the joystick, no rendering glitches.

### 4.4 Grid view

Hit the index/grid button (⊞ icon).

- [ ] Each thumbnail shows its illustration cleanly.
- [ ] No fallback to a generic gray square.
- [ ] Navigation between thumbnails is smooth.

### 4.5 Auto-rotation

Rotate the camera body 90° in either direction.

- [ ] Portrait cards display upright when the camera is held vertically.
- [ ] Landscape cards display upright when the camera is held horizontally.
- [ ] Neither is upside-down regardless of rotation direction.

### 4.6 Coexistence with real photos

- Switch to shoot mode, take 1 photo, switch back to playback.
- [ ] The new real photo coexists with cards.
- [ ] Cards have not been renumbered.

### 4.7 Image info

Press the info button (DISP) to surface metadata overlay.

- [ ] Make/Model show as `SONY ILCE-7M4`.

### 4.8 Photograph the screen

Take phone photos of: single-image view, grid view, and image info overlay. Save under `docs/camera-tests/sony-a7iv/<date>/`.

---

## 5. Triage — what to do when something fails

| Symptom | Most likely cause | Fix |
| --- | --- | --- |
| **Cards simply don't appear in playback at all, no error, no prompt** | Camera's image database (`AVF_INFO/`) wasn't rebuilt to include manually-copied files | **Run `Menu → Setup → Media → Recover Image Database` on the camera.** If that doesn't help (especially on A7 III v4.01+), delete the `AVF_INFO/` folder on the SD card via terminal (`rm -rf /Volumes/<sd>/AVF_INFO/`) before inserting — this forces a clean rebuild from scratch. |
| **"Unable to display" on older Sony body (A7 III etc.) but works on A7 IV/V from same card** | JPEG bitstream fingerprint mismatch — the card was encoded with ImageMagick/libjpeg quantization tables, which the older firmware rejects. | Use cardify v3+ (encodes via Pillow with the template body's `qtables=...optimize=False`). This is the q-table fingerprint fix — see `docs/CAMERA_TEST_RESULTS.md` 2026-05-20 session. |
| "Cannot read image" or `?` icon | Filename / folder violates DCF | Confirm folder is `1NNXXXXX` (e.g. `100MSDCF`) and file is `XXXXNNNN.JPG`. Custom folder names like `101POSES` are silently filtered on some Sony bodies. |
| Image appears but grid thumbnail is blank/gray | EXIF 1st-IFD thumbnail missing or malformed | `cardify.sh --validate suspect.JPG` — the Thumbnail row tells you whether the embedded thumb is present and how big. |
| Image and thumbnail work, but won't zoom | Non-baseline JPEG | `cardify.sh --validate` reports `Encoding`; must be `Baseline DCT, Huffman coding`. |
| Camera prompts "rebuild database" every insert | Required EXIF missing | EXIF diff against a real Sony shot — see §5.2. |
| Cards display upside-down when camera is rotated | EXIF Orientation tag wrong | The script writes 6 for portrait / 1 for landscape. If your portrait shows upside-down, try 8 (manually edit the script). |
| Cards mixed in with real photos in unwanted way | DateTimeOriginal too recent | The script pins DateTimeOriginal to `2024:01:01 12:00:00`. If your photographer's real shoot is from 2024, change the constant in step 5/7 of `cardify.sh`. |
| Numbering jump (real shot was `DSC00150`, next is `DSC09031`) | Sony assigns the next file number as `max_existing + 1`. The pack uses `DSC09000`–`DSC09NNN` to avoid collisions with daily shooting. | Expected behavior — explain to the customer. To keep daily shots in the low range, they can switch `Menu → Setup → File/Folder Settings → File Number → Reset` or create a new REC folder. |
| Manually-copied file works on one A7 IV but not on another of the same model | Different cameras built their `AVF_INFO/AVIN0001.BNP` index from different file sets; new files are missing from one body's index | `rm -rf /Volumes/<sd>/AVF_INFO/` on the host, eject, reinsert in the camera, accept the "Recover image database?" prompt. Forces both bodies onto the same index. |

### 5.1 First step: run validate

When a user reports "doesn't show on my camera", get the actual file from them and run:

```bash
./scripts/cardify.sh --validate suspect.JPG
```

If it reports `✓` on every line, the file is spec-compliant — the problem is on the camera side. Tell the user to run **Recover Image Database** (see top row of the triage table above).

If it reports `✗` on any line, the file is broken. Re-cardify it from source, or do the full EXIF diff below.

### 5.2 EXIF diff against a real Sony JPEG

```bash
exiftool -G1 -a -s template.JPG       | sort > /tmp/real.txt
exiftool -G1 -a -s DSC00099.JPG       | sort > /tmp/ours.txt
diff /tmp/real.txt /tmp/ours.txt | less
```

Or use the helper script:

```bash
python3 scripts/exif_diff.py --real template.JPG --ours DSC00099.JPG
```

Flag any tag the real file has that ours is missing — especially in `[ExifIFD]`, `[InteropIFD]`, `[IFD0]`. Open an issue with the diff.

---

## 6. Recording results

Open [CAMERA_TEST_RESULTS.md](CAMERA_TEST_RESULTS.md) and add a section with date, firmware, body, pass/fail per checklist item, and any quirks.

The first row in this file is the M2 deliverable — it's the proof a body is supported.
