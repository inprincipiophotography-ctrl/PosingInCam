# Camera templates (drop your SOOC JPEGs here — keep their real filename)

The web converter needs **one real straight-out-of-camera (SOOC) JPEG per camera
brand**, in its own folder:

```
templates/sony/    e.g.  DSC09259.JPG
templates/canon/   e.g.  0A0A3799.JPG
templates/nikon/   e.g.  NIKON-SOOC.JPG
```

From each template it reads:
- the camera's exact **JPEG quantization tables** (the fingerprint older bodies validate),
- the EXIF **Make / Model**, and
- the **DCF filename prefix** — taken from the template's *own filename*.

> The original `scripts/cardify.sh` workflow is unaffected — these files are only
> used by the new web converter.

## ⚠️ Do NOT rename the file
The output card names reuse the template's 4-character DCF prefix, exactly like
`scripts/build-pack.sh` does (`build-pack.sh:83-98`). So:

| Template you drop in | Output cards |
|----------------------|--------------|
| `templates/canon/0A0A3799.JPG` | `0A0A0001.JPG, 0A0A0002.JPG, …` |
| `templates/canon/IMG_5000.JPG` | `IMG_0001.JPG, …` |
| `templates/nikon/DSC_1234.JPG` | `DSC_0001.JPG, …` |
| `templates/sony/DSC09259.JPG`  | `DSC00001.JPG, …` |

If the filename isn't a real DCF name (8 chars, last 4 digits), it falls back to
the vendor default prefix (`DSC0` / `IMG_` / `DSC_`). **Copy the JPEG straight off
the card without renaming it** so the prefix matches what your body actually writes
(the only configuration we've hardware-tested).

## What to upload
Use the **oldest** body you own (strictest validator → works on newer ones too):

| Folder | Camera | Status |
|--------|--------|--------|
| `sony/`  | Sony Alpha — ideally **A7 III** | `DSC09259.JPG`, an A7 III SOOC (Model `ILCE-7M3`, firmware v4.01, Standard quality). Replaces the old `DSC00099.JPG`, which was a PosingInCam output with generic libjpeg q-tables (rejected by A7 III). |
| `canon/` | Canon EOS R — ideally **R6** | `0A0A3799.JPG`, an R6 Mark II SOOC (Model `Canon EOS R6m2`); hardware-verified on R6 Mark II + R6 Mark III |
| `nikon/` | Nikon Z — ideally **Z6 / Z6 III** | `NIKON-SOOC.JPG`, a Z6 III SOOC (Model `NIKON Z6_3`); hardware-verified on Z8 + Z9. Not a DCF filename, so cards use the default `DSC_` prefix |

Files must be **unedited** (not re-exported from Lightroom/Photoshop/Canva — those
re-encode and lose the camera fingerprint). `qa/test_encoder.py`
(`test_bundled_templates_are_straight_out_of_camera`) fails if a template has
generic libjpeg q-tables, no MakerNote, or is a PosingInCam output.

## SD-card folder
Output goes under `DCIM/<vendor folder>/` (Sony `100MSDCF`, Canon `100CANON`,
Nikon `100NCZ_X`). Nikon's real folder is body-specific (`100NCZ_8`, …) — copy the
`DSC_*` files into the folder **your** camera created.

## Privacy note
A SOOC JPEG's EXIF can include your camera's serial numbers and your name. The
converter (`converter/encoder.py` `ExifTemplate.patched()`) blanks these to NULs
in **every output card** (in place, so nothing in the EXIF block moves):

| Blanked tag | Where |
|--------------|-------|
| `BodySerialNumber` (0xA431) | Exif IFD |
| `LensSerialNumber` (0xA435) | Exif IFD |
| `CameraOwnerName` (0xA430) | Exif IFD |
| `ImageUniqueID` (0xA420) | Exif IFD |
| `Artist` (0x013B) | 0th + 1st IFD |
| `Copyright` (0x8298) | 0th + 1st IFD |
| GPS IFD | every value zeroed except GPSVersionID |

The template's own thumbnail is replaced with one of the card.

Everything else is kept on purpose: Make, Model, Software, lens model,
exposure fields, the rest of the standard tag set, and the binary **MakerNote**
(kept verbatim, exactly like the hardware-tested cardify.sh output — so the
template camera's serial number inside the MakerNote does ship in every card).
Camera playback compatibility depends on these, so don't strip more broadly
without a hardware test. `qa/test_encoder.py`
(`test_identifying_tags_stripped_for_every_vendor`) fails if any tag in the
table above leaks for any vendor.

The **template files themselves** still carry the serials. Keep this repo
private, or strip the serials from the templates first.
