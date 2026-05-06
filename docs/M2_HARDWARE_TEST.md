# M2 — Sony A7 IV hardware test

> Goal: confirm a real Sony A7 IV plays back our generated JPEGs in single-image view, in grid view (showing the line-art thumbnail), and at full zoom.

This is the first milestone where reality meets spec. Software is done; this guide tells you exactly what to do with the camera in your hands.

Time budget: 30–60 minutes if it works first time, 2–3 hours if you have to iterate on EXIF.

---

## 0. What you need

- Sony A7 IV body, charged.
- One SD card you don't mind reformatting.
- USB SD card reader (or a card slot on your laptop).
- A laptop with the repo set up (`pip install -e ".[dev]"` already run, see [README](../README.md)).
- 5–10 minutes of access to a real, recent photo from the same A7 IV — saved as `tests/fixtures/real-a7iv.JPG` for diff. (Skip if not available; we'll work around it.)
- `exiftool` installed: `brew install exiftool` / `apt install libimage-exiftool-perl`.

Optional but recommended: phone camera or a second photographer to take photos of the camera's screen for the result archive.

---

## 1. Pre-flight

### Note your firmware

```
Camera menu → Setup → Setup Option → Version
```

Write it down — different firmwares behave differently and we want this in the result file.

### Format the card *in the camera*

Not on the laptop. The camera writes its filesystem and DCF skeleton on first format.

```
Menu → Setup → Media → Format
```

Choose Slot 1 (or whichever slot you'll use). Confirm.

After formatting, the card has `DCIM/` (possibly empty, possibly with `100MSDCF/`). That's your baseline.

### Take 1–2 real photos

Take two normal photos with the camera onto the freshly formatted card. This:

1. Confirms the card is healthy.
2. Gives you a real Sony JPEG to diff against.
3. Lets us see exactly what folder + filename Sony assigns on this body + firmware (this may differ from our profile's defaults).

Eject and read the card on your laptop. Note:

- The exact folder name (likely `100MSDCF`).
- The exact filename pattern (likely `DSC00001.JPG`, `DSC00002.JPG`).

If they differ from our `sony-a7iv` profile, **update the profile before continuing** — see [§5 Iterating on the profile](#5-iterating-on-the-profile).

Optionally copy one of those JPEGs to `tests/fixtures/real-a7iv.JPG` for the diff in §4.

---

## 2. Build and copy

From the repo root:

```bash
# 1. Build the cards into a local staging dir.
posingincam build --camera sony-a7iv --pose P-001 --out dist/sony-a7iv

# 2. Run our DCF compliance check against the output.
.venv/bin/python -m tests.dcf_validator dist/sony-a7iv
# Expect: ✓ DCF compliant
```

Mount your SD card. Find its path:

- macOS: `ls /Volumes/` — looks like `/Volumes/Untitled` or `/Volumes/SONY` if labeled.
- Linux: `lsblk` then `/media/<user>/<label>` or `mount`.
- Windows: drive letter, e.g. `D:\`.

**Important**: Sony's first format wrote `DCIM/100MSDCF/`. Our build writes into `DCIM/199MSDCF/`. The two folders coexist by design (folder number 199 keeps us out of the user's working counter). Do not delete the existing `100MSDCF/`.

Copy:

```bash
# macOS / Linux
rsync -av dist/sony-a7iv/DCIM/ /Volumes/<your-card>/DCIM/

# or with cp
cp -R dist/sony-a7iv/DCIM/199MSDCF /Volumes/<your-card>/DCIM/
```

```powershell
# Windows
xcopy /E /I dist\sony-a7iv\DCIM\199MSDCF D:\DCIM\199MSDCF
```

**Eject cleanly.** This matters — pulling the card unsafely can leave half-written FAT entries that the camera reads as corrupt.

---

## 3. On-camera verification

Insert the card. Switch to playback mode (▶ button).

Run the checklist below in order. Mark each ✓ / ✗ — write directly into [docs/CAMERA_TEST_RESULTS.md](CAMERA_TEST_RESULTS.md) as you go.

### 3.1 Card mounts without complaints

- [ ] Camera does not prompt to "recover" or "rebuild database" on insertion.
- [ ] No "no images" / "cannot read card" messages.

If the camera prompts to rebuild the image database, that's usually fine — let it run, then continue. Note it in results.

### 3.2 Single-image view (full screen)

Scroll backward in playback (left arrow) or jump to the last folder. Find your card.

- [ ] The card appears at full resolution. Not a placeholder, not a "?".
- [ ] Title text is sharp.
- [ ] Illustration renders clean (no scaling artifacts at 100%).
- [ ] Verbal cue is legible without zoom.

### 3.3 Zoom in

Hit the zoom-in button (toggle on the back wheel) and step in to ~100%.

- [ ] Zoom works at all.
- [ ] At max zoom, body text (positioning bullets, camera notes) is sharp and readable.
- [ ] Pan around with the joystick — no rendering glitches.

### 3.4 Grid view

Hit the index/grid button (⊞ icon, usually next to playback). Step out to 9-frame or larger view.

- [ ] **Each thumbnail shows the line illustration only** — no text.
- [ ] No fallback to a generic gray square.
- [ ] No fallback to scaled-down full card with text bleeding through.
- [ ] Navigation between thumbnails is smooth (sub-second).

This is the most important test. If the line-art thumbnail doesn't render, the EXIF 1st-IFD thumbnail isn't being respected. See [§4 Triage](#4-triage).

### 3.5 Coexistence with real photos

- Switch to shoot mode.
- Take 1 photo.
- Switch back to playback.

- [ ] The new real photo coexists with the cards. Both visible.
- [ ] Cards have not been renumbered or moved.
- [ ] The card folder (`199MSDCF`) and the camera's working folder (likely `100MSDCF`) are both intact.

### 3.6 Image info

Press the info button (DISP) once or twice to surface the metadata overlay.

- [ ] Make/Model show as `SONY ILCE-7M4`.
- [ ] Date shows `2000-01-01` (intentional — distinguishes our cards from real shoots).

### 3.7 Photograph the screen

Take a phone photo of:

1. The card in single-image view.
2. The grid view showing the line-art thumbnail.
3. The image info overlay.

Save under `docs/camera-tests/sony-a7iv/<date>/`. These go in the results doc and the eventual public landing page.

---

## 4. Triage — what to do when something fails

| Symptom | Most likely cause | What to try |
| --- | --- | --- |
| Camera says "Cannot read image" or shows `?` icon | Filename or folder violates DCF | Double-check the folder is `1NN<5-char-tag>` and file is `<4-char-prefix><4-digit>.JPG`. Re-run `python -m tests.dcf_validator dist/sony-a7iv`. |
| Image appears but thumbnail in grid is blank/gray | EXIF 1st-IFD thumbnail missing or malformed | Run `exiftool -Thumbnail* dist/sony-a7iv/DCIM/199MSDCF/DSC00001.JPG`. Should print thumbnail metadata. If empty, our embed step failed silently — open an issue. |
| Image and thumbnail both work, but won't zoom | JPEG is corrupt / non-standard / progressive | Re-encode baseline (already our default). Run `exiftool -JpegProcessing dist/sony-a7iv/.../DSC00001.JPG`; should be `Baseline DCT, Huffman coding`. |
| Camera prompts "rebuild database" every insert | Our cards aren't being indexed, missing required EXIF | See §4.1 EXIF diff below. |
| Cards work but appear at top of timeline mixed with shoots | DateTime override didn't stick | `exiftool -DateTimeOriginal -DateTime` should show `2000:01:01 00:00:01`. |
| Camera says "incompatible image" | Make/Model spoof rejected; firmware checks for additional Sony tags | Try setting `spoof_make_model: false` in the profile, rebuild, retest. If that works, we keep generic Make/Model and document the trade-off. |

### 4.1 EXIF diff against a real Sony JPEG

If something is off and you have a real shot at `tests/fixtures/real-a7iv.JPG`:

```bash
# Print full EXIF for both files, sorted, side by side.
exiftool -G1 -a -s tests/fixtures/real-a7iv.JPG | sort > /tmp/real.txt
exiftool -G1 -a -s dist/sony-a7iv/DCIM/199MSDCF/DSC00001.JPG | sort > /tmp/ours.txt
diff /tmp/real.txt /tmp/ours.txt | less
```

Flag any tag the real file has that ours is missing — especially in the `[ExifIFD]` and `[IFD0]` groups. The ones to watch:

- `Make`, `Model`, `Software` — required.
- `ExifVersion`, `FlashpixVersion` — sometimes required.
- `ColorSpace`, `ComponentsConfiguration` — usually required.
- `ExifImageWidth`, `ExifImageHeight` — should match the actual JPEG.
- `Compression` (1st IFD), `ThumbnailLength`, `ThumbnailOffset` — required for the embedded thumbnail.

When you find a missing tag that's likely required, file an issue with the diff and we'll add it to `render/exif.py` in a follow-up commit.

### 4.2 Convenience helper script

There's a helper that runs both diffs for you:

```bash
python scripts/exif_diff.py \
    --real tests/fixtures/real-a7iv.JPG \
    --ours dist/sony-a7iv/DCIM/199MSDCF/DSC00001.JPG
```

(See `scripts/exif_diff.py` — it just wraps the exiftool calls and prints a readable side-by-side.)

---

## 5. Iterating on the profile

When you change the profile to fix something, do it surgically:

### Folder/file naming was wrong

Edit `src/posingincam/cameras/profiles/sony-a7iv.yaml`:

```yaml
dcf:
  folder_number: 199        # change if Sony picks something different
  folder_tag: MSDCF         # 5 chars, exact Sony convention
  file_prefix: DSC0         # 4 chars
  starting_index: 1
```

Rebuild, re-validate, re-copy, re-test.

### EXIF tag was missing

This requires a code change in `src/posingincam/render/exif.py`. The `0th`, `Exif`, and `1st` dicts are where you add tags. Open a small PR with the diff from §4.1 attached as evidence.

### Spoof toggle

```yaml
exif:
  spoof_make_model: false   # try if `true` is being rejected
```

When `false`, we still write `make`/`model` from the YAML — set them to a vendor-neutral pair (e.g. `make: PosingInCam`, `model: Generic 3:2`).

### Image dimensions

Sony A7 IV's largest JPEG is 7008×4672. We render at 3840×2560 (a comfortable middle, smaller files, fast playback). If the camera refuses 3840×2560 specifically, try 6000×4000 (M-size) or 3504×2336 (S-size) by editing:

```yaml
image:
  width: 6000
  height: 4000
```

### Always rebuild before retesting

```bash
rm -rf dist/sony-a7iv
posingincam build --camera sony-a7iv --pose P-001 --out dist/sony-a7iv
python -m tests.dcf_validator dist/sony-a7iv
```

Then re-format the card (or at least delete `199MSDCF/`), re-copy, re-insert. Cameras can cache thumbnails — formatting is the safest reset.

---

## 6. Recording results

Open [docs/CAMERA_TEST_RESULTS.md](CAMERA_TEST_RESULTS.md) and add a section with:

- Date.
- Camera firmware.
- Build commit SHA (`git rev-parse --short HEAD`).
- Pass/fail per checklist item from §3.
- Any deviations from defaults (folder number, image size, spoof toggle).
- Links/paths to the screen photos.
- Any quirks / surprises.

Commit the results doc with the photos. The first row in this file is the M2 deliverable.

---

## 7. Promotion to Tier 1

Sony A7 IV moves from "MVP target" to "Tier 1, supported" when:

- All checklist items in §3 pass.
- Results recorded in `CAMERA_TEST_RESULTS.md`.
- Screen photos committed.
- Profile in the repo matches the tested configuration.
- ADR 0004 (EXIF spoof strategy) finalized based on what we learned.
- `docs/CAMERA_COMPATIBILITY.md` Sony A7 IV row updated from "Profile in M2" to "Tier 1 ✓ <date>".

After that, M2 is done and we move to M3 (multi-camera). Any other body should follow the same protocol — that's the point of having the protocol document.

---

## 8. If you can't get it working

Don't grind on it indefinitely. After two iteration cycles where the diff doesn't reveal the root cause:

1. Save the failing JPEG.
2. Save the EXIF diff against the real Sony shot.
3. Open an issue with both attached.
4. Try the [generic-3-2](../src/posingincam/cameras/profiles/generic-3-2.yaml) profile as a control — does *that* play back? If yes, the issue is Sony-specific spoofing; if no, it's a deeper JPEG/EXIF problem.

The result of "we tried for two days and Sony rejects our JPEGs" is also a valid M2 outcome — it just changes the project shape (e.g., we'd consider buying a single Cue card to compare its EXIF against ours). Document it and move on.
