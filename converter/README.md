# converter/ — web conversion core

Pure-Python port of the PosingInCam camera-card conversion, built so it can run
inside a **Vercel Python serverless function** (no exiftool / Perl). It powers the
"Pose Cards" web app; a customer uploads design images and gets a ready-to-copy
SD-card ZIP.

## ⛔ Does not touch the CLI
This package is fully self-contained. It **does not import, modify, or run**
`scripts/cardify.sh` (the author's hand-used Canva workflow stays as-is). It only
*reads* a real-camera template JPEG from `templates/`.

## Layout
| File | Purpose |
|------|---------|
| `encoder.py`   | Core: `convert(image_bytes, template_path, orientation)` → camera-spec JPEG bytes (1920×1280, baseline 4:2:2, template q-tables, DCF/EXIF, embedded thumbnail). |
| `pack.py`      | `build_zip(designs, vendor, ...)` → SD-card ZIP (`DCIM/<folder>/…` + HR/EN instructions). |
| `cli.py`       | Local end-to-end: images → ZIP. |
| `selftest.py`  | Verifies every vendor's output against the spec (mirrors `cardify.sh` validate_card, in pure Python). |
| `templates/`   | Per-vendor SOOC templates (`templates/<vendor>/`), kept under their real DCF filename so the output prefix is read off the name (build-pack.sh behaviour). See its README. |
| `requirements.txt` | `Pillow`, `piexif`. |

## Use
```bash
pip install -r converter/requirements.txt

# verify the spec is met (no exiftool needed)
python -m converter.selftest

# build a card pack locally
python -m converter.cli --vendor sony --out cards.zip design1.png design2.jpg
```

```python
from converter import encoder, pack
zip_bytes = pack.build_zip([("a.png", img_bytes)], vendor="sony")   # for the web fn
```

## How it mirrors the verified CLI
Behaviour copied (not imported) from `scripts/cardify.sh`: always 1920×1280;
portrait rotated 90° CCW + EXIF Orientation=6; Pillow `qtables=` from the template
with `optimize=False`; baseline, 4:2:2; APP0/JFIF stripped; fixed date,
ExifImage W/H 1920/1280, YCbCrPositioning=2, fresh ~160px thumbnail.

## EXIF = the template's own block, patched in place
cardify.sh copies the template's whole EXIF with `exiftool -tagsFromFile -all:all`
(MakerNotes included, template byte order) and that is what played back on Sony
A7 III/IV/V, Canon R6 II/III and Nikon Z8/Z9. The web encoder does the same
without exiftool: it reuses the template's EXIF block **byte for byte** and only
overwrites fixed-size values in place (Orientation, dates, ExifImage W/H,
YCbCrPositioning), blanks the owner tags, zeroes GPS, and writes the new
thumbnail into the template's thumbnail slot. Nothing moves, so MakerNote offsets
stay valid. `qa/test_encoder.py` checks byte order, MakerNote and q-tables match
the template for every vendor.

The ZIP stamps every card with the same 2024-01-01 12:00 time as its EXIF date,
so the unzipped files carry the same mtime cardify.sh sets with `touch`.
