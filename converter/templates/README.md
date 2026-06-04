# Camera templates (drop your SOOC JPEGs here — keep their real filename)

The web converter needs **one real straight-out-of-camera (SOOC) JPEG per camera
brand**, in its own folder:

```
templates/sony/    e.g.  DSC00099.JPG
templates/canon/   e.g.  0A0A3799.JPG
templates/nikon/   e.g.  DSC_1234.JPG
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
| `templates/sony/DSC00099.JPG`  | `DSC00001.JPG, …` |

If the filename isn't a real DCF name (8 chars, last 4 digits), it falls back to
the vendor default prefix (`DSC0` / `IMG_` / `DSC_`). **Copy the JPEG straight off
the card without renaming it** so the prefix matches what your body actually writes
(the only configuration we've hardware-tested).

## What to upload
Use the **oldest** body you own (strictest validator → works on newer ones too):

| Folder | Camera | Status |
|--------|--------|--------|
| `sony/`  | Sony Alpha — ideally **A7 III** | bootstrapped (`DSC00099.JPG`); replace with a real A7 III SOOC for guaranteed A7 III support |
| `canon/` | Canon EOS R — ideally **R6** | **missing — upload needed** |
| `nikon/` | Nikon Z — ideally **Z6 / Z6 III** | **missing — upload needed** |

Files must be **unedited** (not re-exported from Lightroom/Photoshop/Canva — those
re-encode and lose the camera fingerprint).

## SD-card folder
Output goes under `DCIM/<vendor folder>/` (Sony `100MSDCF`, Canon `100CANON`,
Nikon `100NCZ_X`). Nikon's real folder is body-specific (`100NCZ_8`, …) — copy the
`DSC_*` files into the folder **your** camera created.

## Privacy note
A SOOC JPEG's EXIF can include your camera's serial number. The output cards
**drop MakerNotes**, but the template files themselves still carry that metadata —
keep this repo private, or strip the serial first.
