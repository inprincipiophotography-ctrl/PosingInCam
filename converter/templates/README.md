# Camera templates (drop your SOOC JPEGs here)

The web converter (`converter/encoder.py`) needs **one real straight-out-of-camera
(SOOC) JPEG per camera brand**. It reads two things from it:

- the camera's exact **JPEG quantization tables** (the "fingerprint" older bodies
  validate), and
- the EXIF **Make / Model**.

> The original `scripts/cardify.sh` workflow is unaffected — these files are only
> used by the new web converter.

## What to upload

Put **unedited** JPEGs **straight off the card** (not exported from Lightroom /
Photoshop / Canva — those re-encode and lose the camera fingerprint). Name them
exactly:

| File         | Camera (use the **oldest** body you own — strictest validator) |
|--------------|----------------------------------------------------------------|
| `sony.JPG`   | Sony Alpha — ideally **A7 III** (works on A7 IV / A7 V too)     |
| `canon.JPG`  | Canon EOS R — ideally **R6**                                    |
| `nikon.JPG`  | Nikon Z — ideally **Z6 / Z6 III**                               |

Filenames are case-sensitive: capital `.JPG`.

## Status

- `sony.JPG` — **bootstrapped** from `samples/sony-a7iv/DSC00099.JPG` (a real
  Sony-structured file). Good for development and A7 IV / A7 V. For guaranteed
  A7 III compatibility, replace it with a real A7 III SOOC.
- `canon.JPG` — **missing**, upload needed before Canon conversion works.
- `nikon.JPG` — **missing**, upload needed before Nikon conversion works.

## How to add them

Commit the files into this folder on the working branch, e.g.:

```
git add converter/templates/canon.JPG converter/templates/nikon.JPG
git commit -m "Add Canon and Nikon camera templates"
```

(or attach them in chat and I'll place them here).

## Privacy note

A SOOC JPEG's EXIF can include your camera's serial number. The converter
**drops MakerNotes** from the output cards, but the template files themselves
still carry that metadata — keep this repo private, or strip the serial first.
