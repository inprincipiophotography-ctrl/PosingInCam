# Contributing to PosingInCam

Thanks for considering a contribution. This project is small and shell-shaped on purpose. There are three things people typically contribute:

1. [**Confirmation that a camera body works**](#1-confirm-a-camera-works) (or doesn't)
2. [**Support for a new vendor**](#2-add-support-for-a-new-vendor) (Canon, Nikon, Fujifilm, …)
3. [**Improvements to `cardify.sh`**](#3-improve-cardifysh)

You don't need to write code for #1 — just run the script and report back.

---

## 1. Confirm a camera works

If you have a camera body we haven't tested, please:

1. Follow [docs/M2_HARDWARE_TEST.md](docs/M2_HARDWARE_TEST.md) (it's written for Sony A7 IV but applies to any Sony body and adapts trivially to other vendors).
2. Open a PR adding a row to [docs/CAMERA_TEST_RESULTS.md](docs/CAMERA_TEST_RESULTS.md) with: body, firmware, date, pass/fail per checklist item, optionally a phone photo of the camera screen.

A confirmed-working report is genuinely valuable — it's the difference between "should work" and "Tier 1 supported."

---

## 2. Add support for a new vendor

`cardify.sh` is currently Sony-specific. Adding Canon / Nikon / Fujifilm / Panasonic / Leica involves three things:

1. **Folder/file naming convention.** The output filename and the SD card folder differ per vendor. `100MSDCF/DSC0NNNN.JPG` for Sony, `100CANON/IMG_NNNN.JPG` for Canon, `100NCZ_8/DSC_NNNN.JPG` for Nikon Z8, etc. Documented per vendor in [docs/CAMERA_COMPATIBILITY.md](docs/CAMERA_COMPATIBILITY.md).
2. **EXIF Make/Model values.** Each vendor has its own quirks — Canon uses `Canon` / `Canon EOS R6m2`, Nikon uses `NIKON CORPORATION` / `NIKON Z 8`, etc.
3. **MakerNotes blob.** Every vendor has its own proprietary IFD inside EXIF. The current script copies it from the user's template shot (so anyone with that body can produce compatible files); confirming this works on a vendor's body is the main test.

Procedure to add Canon (as an example):

1. Take a photo on the Canon body, save it as `template.JPG`.
2. Try `cardify.sh template.JPG mycard.jpg IMG_0099.JPG` — note that you'll need to edit the script to:
   - Change the default output filename pattern from `DSCNNNNN.JPG` to `IMG_NNNN.JPG` (4 chars + 4 digits).
   - Possibly adjust the EXIF Orientation handling if Canon stores portrait differently.
3. Drop into `DCIM/100CANON/` on the SD card.
4. Test playback.
5. Document findings + open a PR.

For now we keep this in a single script with a vendor flag (e.g. `--vendor sony|canon|nikon|fuji`) once we have a confirmed-working second vendor. Until then, fork the script.

---

## 3. Improve `cardify.sh`

Patches welcome. Keep in mind:

- **Single shell script** is a feature, not a bug. We don't add a build system, package manager, or test harness for one 200-line file.
- **macOS-first** because that's where most working photographers are. Linux support is fine if it doesn't add complexity. Windows is currently out of scope (the script uses macOS-specific tools like `sips`, though it falls back to ImageMagick / Python+Pillow).
- **No hard runtime deps beyond exiftool**. ImageMagick is recommended but optional (Pillow and sips fallbacks exist). Don't add new ones lightly.
- **Idempotent**. Running the script twice on the same input should produce the same output (modulo embedded timestamps).

### Before you push

- `shellcheck scripts/cardify.sh` (CI will run it).
- Test against the real Sony A7 IV sample at [`samples/sony-a7iv/DSC00099.JPG`](samples/sony-a7iv/DSC00099.JPG) as a regression check.

---

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Don't be a jerk. Photographers come from many backgrounds and we want all of them here.

## Reports go to the maintainers

Open an issue or a discussion — over-discuss rather than under-discuss.
