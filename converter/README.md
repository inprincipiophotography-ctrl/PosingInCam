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
| `selftest.py`  | Verifies output against the spec (mirrors `cardify.sh` validate_card, in pure Python). |
| `templates/`   | Bundled SOOC templates (`sony.JPG`, `canon.JPG`, `nikon.JPG`). See its README. |
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
with `optimize=False`; baseline, 4:2:2; APP0/JFIF stripped; EXIF Make/Model from
template, InteropIndex=R98, ExifImage W/H 1920/1280, fixed date, YCbCrPositioning=2,
fresh ~160px thumbnail.

## Known caveat — MakerNotes
The output omits camera **MakerNotes** (the reference validator doesn't require
them, and the hardware-confirmed sample ships without them). This should play back
on Sony/Canon/Nikon, but the **only definitive test is on a real body** — verify on
the oldest one you own. If a strict body ever rejects it, the documented fallback is
a small Docker service that runs the original exiftool pipeline.
