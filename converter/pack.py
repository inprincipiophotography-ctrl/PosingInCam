"""
pack.py — assemble converted cards into a ready-to-copy SD-card ZIP.

The ZIP mirrors the camera's own layout (``DCIM/<vendor folder>/``) so the
customer extracts it straight onto the card root. It also bundles short,
vendor-specific instructions (Croatian + English), including the fix for the
rare Sony that doesn't show new files straight away: *Recover Image Database*.

Used by the Vercel Python function (Part B) and the local CLI (cli.py).
"""

from __future__ import annotations

import io
import os
import zipfile

from . import encoder

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")

# Per-vendor SD-card instructions. Sourced from CUSTOMER_INSTRUCTIONS.md and
# docs/user-guide-*.html (the existing CLI's customer docs).
_INSTRUCTIONS = {
    "sony": {
        "folder": "DCIM/100MSDCF/",
        "hr": (
            "Bez formatiranja: kartice idu uz tvoje fotke, postojeće fotke ostaju.\n"
            "1. Nema još mape DCIM/100MSDCF/ na kartici? Snimi jednu običnu fotku i aparat je napravi.\n"
            "2. Kopiraj sve .JPG iz DCIM/100MSDCF/ ovog ZIP-a u istoimenu mapu na kartici.\n"
            "3. Pritisni ▶ Playback i listaj, kartice su među fotkama.\n"
            "   Većina Sony aparata ih prikaže odmah. Ako se ne pojave:\n"
            "   MENU → Setup → Media → Recover Image Database → potvrdi (10–30 s).\n"
            "4. I dalje ih nema (stariji aparati, npr. A7 III)? Na računalu obriši mapu\n"
            "   AVF_INFO s kartice, vrati karticu u aparat i potvrdi Recover Image Database."
        ),
        "en": (
            "No formatting: the cards go next to your photos, which stay as they are.\n"
            "1. No DCIM/100MSDCF/ folder on the card yet? Take one ordinary photo and the camera creates it.\n"
            "2. Copy every .JPG from this ZIP's DCIM/100MSDCF/ into that folder on the card.\n"
            "3. Press ▶ Playback and scroll. The cards appear among your shots.\n"
            "   Most Sony bodies show them straight away. If they don't appear:\n"
            "   MENU → Setup → Media → Recover Image Database → confirm (10–30 s).\n"
            "4. Still not showing (older bodies such as the A7 III)? On the computer, delete\n"
            "   the AVF_INFO folder on the card, put it back in and confirm Recover Image Database."
        ),
    },
    "canon": {
        "folder": "DCIM/100CANON/",
        "hr": (
            "Bez formatiranja: kartice idu uz tvoje fotke, postojeće fotke ostaju.\n"
            "1. Nema još mape DCIM/100CANON/ na kartici? Snimi jednu običnu fotku i aparat je napravi.\n"
            "2. Kopiraj sve .JPG iz DCIM/100CANON/ ovog ZIP-a u istoimenu mapu na kartici.\n"
            "3. Canon ne treba rebuild baze. Ubaci karticu i pritisni ▶ Playback.\n"
            "   (INFO prikazuje dodatne podatke.)"
        ),
        "en": (
            "No formatting: the cards go next to your photos, which stay as they are.\n"
            "1. No DCIM/100CANON/ folder on the card yet? Take one ordinary photo and the camera creates it.\n"
            "2. Copy every .JPG from this ZIP's DCIM/100CANON/ into that folder on the card.\n"
            "3. No database rebuild on Canon. Insert the card and press ▶ Playback.\n"
            "   (Press INFO to reveal extra details.)"
        ),
    },
    "nikon": {
        "folder": "DCIM/100NCZ_X/",
        "hr": (
            "Bez formatiranja: kartice idu uz tvoje fotke, postojeće fotke ostaju.\n"
            "1. Nema još mape DCIM/100NCZ_… na kartici? Snimi jednu običnu fotku i aparat je napravi (npr. 100NCZ_8 za Z8).\n"
            "2. Kopiraj DSC_*.JPG iz ovog ZIP-a u TU mapu koju je tvoj aparat napravio\n"
            "   (NE u 100NCZ_X, to je samo primjer imena).\n"
            "3. Nikon ne treba rebuild baze. Ako kartice ne vidiš:\n"
            "   PLAYBACK MENU → Playback folder → All.\n"
            "4. Pritisni ▶ Playback i listaj."
        ),
        "en": (
            "No formatting: the cards go next to your photos, which stay as they are.\n"
            "1. No DCIM/100NCZ_… folder on the card yet? Take one ordinary photo and the camera creates it (e.g. 100NCZ_8 for Z8).\n"
            "2. Copy the DSC_*.JPG from this ZIP into THAT folder your camera made\n"
            "   (NOT 100NCZ_X, that name is just a placeholder).\n"
            "3. No database rebuild on Nikon. If you don't see the cards:\n"
            "   PLAYBACK MENU → Playback folder → All.\n"
            "4. Press ▶ Playback and scroll."
        ),
    },
}


def instructions(vendor: str) -> tuple[str, str]:
    """Return (croatian, english) instruction text for the vendor."""
    info = _INSTRUCTIONS[vendor]
    return info["hr"], info["en"]


def convert_cards(designs: list[tuple[str, bytes]], vendor: str, orientation: str = "auto",
                  watermark: bool = False, start: int = 0,
                  template_dir: str = TEMPLATES_DIR) -> list[tuple[str, bytes]]:
    """Convert every design and return [(card_filename, jpeg_bytes), ...].

    Args:
        designs: list of (original_filename, image_bytes). Order is preserved.
        vendor:  "sony" | "canon" | "nikon".
        orientation: "auto" | "landscape" | "portrait" (applied to every design).
        start: how many cards this user already has; numbering continues after it
               (start=0 -> <prefix>0001, start=12 -> <prefix>0013). Batches keep
               unique filenames on the card, so nothing needs renaming by hand.
        template_dir: where the bundled vendor templates live.
    """
    if vendor not in encoder.VENDORS:
        raise ValueError(f"unknown vendor {vendor!r}")
    if not designs:
        raise ValueError("no designs provided")
    # DCF numbers are 0001..9999; restart rather than overflow into 5 digits.
    if start < 0 or start + len(designs) > 9999:
        start = 0

    v = encoder.VENDORS[vendor]
    template_path = encoder.template_path_for(vendor, template_dir)
    prefix = encoder.dcf_prefix(template_path, v.default_prefix)  # build-pack.sh:83-98
    qtables, exif_base = encoder.template_meta(template_path)
    if exif_base.make != v.make:
        raise ValueError(f"{vendor} template is a {exif_base.make or 'unknown'} file, not {v.make}")

    cards = []
    for i, (_orig_name, image_bytes) in enumerate(designs):
        jpeg = encoder.convert_with(image_bytes, qtables, exif_base, orientation, watermark)
        cards.append((encoder.filename_for(vendor, start + i, prefix), jpeg))
    return cards


# ZIP entry timestamp for every card = the EXIF date the encoder pins
# (encoder.FIXED_DATE). Unzipping sets the file's modified time from it, and
# Finder/Explorer keep that time when copying to the SD card — the same thing
# cardify.sh's `touch` + `cp -p` does, which older Sony firmware (A7 III)
# checks against DateTimeOriginal.
CARD_ZIP_TIME = (2024, 1, 1, 12, 0, 0)


def zip_from_cards(cards: list[tuple[str, bytes]], vendor: str) -> bytes:
    """Lay already-converted cards out as a ready-to-copy SD-card ZIP."""
    v = encoder.VENDORS[vendor]
    _hr, en = instructions(vendor)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, jpeg in cards:
            info = zipfile.ZipInfo(f"DCIM/{v.folder}/{filename}", date_time=CARD_ZIP_TIME)
            info.external_attr = 0o644 << 16
            zf.writestr(info, jpeg, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr("README.txt", en + "\n")
    return buf.getvalue()


def build_zip(designs: list[tuple[str, bytes]], vendor: str, orientation: str = "auto",
              watermark: bool = False, start: int = 0,
              template_dir: str = TEMPLATES_DIR) -> bytes:
    """Convert every design and return a ZIP laid out like an SD card."""
    return zip_from_cards(
        convert_cards(designs, vendor, orientation, watermark, start, template_dir), vendor)
