# Camera Compatibility

What we know about how each vendor stores JPEGs on SD cards. Use this when adapting `cardify.sh` for a body other than Sony A7 IV.

| Field | Value |
| --- | --- |
| **Status** | Sony A7-series confirmed; other vendors documented but untested. |
| **Last updated** | 2026-05-07 |

## DCF reference

The Design rule for Camera File system (JEITA CP-3461) is what cameras follow when reading SD cards. To be playback-readable, a JPEG must:

- Live under `<volume>/DCIM/`
- Be inside a subfolder named `NNNXXXXX` where `NNN` ∈ 100..999 and `XXXXX` is 5 alphanumeric (or `_`) characters
- Be named `XXXXNNNN.JPG` where `XXXX` is 4 alphanumeric (or `_`) characters and `NNNN` ∈ 0001..9999
- Be a valid baseline EXIF JPEG with at minimum Make/Model/Orientation tags
- Have an embedded 160×120 thumbnail in EXIF IFD1
- Carry the `R98` InteropIFD marker (DCF basic file)

## Per-vendor conventions

| Vendor | Folder | File prefix | EXIF Make | EXIF Model example | Status |
| --- | --- | --- | --- | --- | --- |
| **Sony** | `100MSDCF` | `DSC0` | `SONY` | `ILCE-7M4`, `ILCE-7SM3` | ✓ A7 IV confirmed (this repo) |
| Canon | `100CANON` | `IMG_` | `Canon` | `Canon EOS R6m2`, `Canon EOS R5` | untested |
| Nikon (Z series) | `100NCZ_8` (varies by body) | `DSC_` | `NIKON CORPORATION` | `NIKON Z 8`, `NIKON Z 6_3` | untested |
| Fujifilm | `100_FUJI` | `DSCF` | `FUJIFILM` | `X-T5` | untested |
| Panasonic | `100_PANA` | `P101` (varies) | `Panasonic` | `DC-S5M2` | untested |
| Leica | `100LEICA` | `L100` | `LEICA CAMERA AG` | `SL3` | untested |

> Folder name patterns are best-effort. Many bodies auto-generate the trailing 5 chars from a date if "Date Form" folder naming is enabled (e.g. Sony `10060504`). Check what your specific body writes the first time you take a photo.

## Sony quirks (for reference)

- Default folder: `100MSDCF`. New folders auto-created when filename hits 9999.
- File prefix: `DSC0` (sRGB) or `DSC1`+ (Adobe RGB).
- Portrait JPEGs are stored as **landscape pixels** (e.g. 6240×4160 even when the body is held vertically) with EXIF `Orientation=6` (rotate 90° CW for display) telling the camera to rotate at playback. `cardify.sh` follows this convention for portrait cards.
- `MAH_FILE_FORMAT.IND` and `AVCHD/PRIVATE/` are video-related, irrelevant to us.

## Canon quirks (anticipated)

- Default folder: `100CANON`.
- File prefix: `IMG_` (sRGB) or `_IMG` (Adobe RGB).
- `MISC/` may contain DPOF protect files.
- Canon Image Verification ("Original Decision Data") if present must be dropped — we don't have a real Canon body to confirm.

## Nikon quirks (anticipated)

- Folder name varies more than other vendors: `100NCZ_8` for Z 8, `100NCD850` for D850, etc.
- File prefix: `DSC_` (sRGB) or `_DSC` (Adobe RGB).

## Fujifilm quirks (anticipated)

- Underscore in folder name (`100_FUJI`) — DCF-valid.
- File prefix: `DSCF`.

## Adding a new body to the matrix

1. Take one photo with the body.
2. Read it off the card; note the exact folder + filename.
3. Run `exiftool -G1 -a -s` on it; note Make / Model / Software / MakerNotes blob size.
4. Try `cardify.sh` against it (you may need to edit the output filename pattern in the script).
5. Test on the body; document findings in [CAMERA_TEST_RESULTS.md](CAMERA_TEST_RESULTS.md) and update the matrix above.
