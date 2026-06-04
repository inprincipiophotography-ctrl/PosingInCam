"""
pack.py — assemble converted cards into a ready-to-copy SD-card ZIP.

The ZIP mirrors the camera's own layout (``DCIM/<vendor folder>/``) so the
customer extracts it straight onto the card root. It also bundles short,
vendor-specific instructions (Croatian + English), including the step people
most often forget: Sony's *Recover Image Database*.

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
            "1. U aparatu: MENU → Setup → Media → Format (formatiraj karticu).\n"
            "2. Snimi jednu običnu fotku da aparat napravi DCIM/100MSDCF/ mapu.\n"
            "3. Kopiraj sve .JPG iz DCIM/100MSDCF/ ovog ZIP-a u istoimenu mapu na kartici.\n"
            "4. NAJVAŽNIJE: MENU → Setup → Media → Recover Image Database → potvrdi.\n"
            "   Bez ovog koraka aparat NEĆE prikazati kartice.\n"
            "5. Pritisni ▶ Playback i listaj — pose kartice su među fotkama."
        ),
        "en": (
            "1. In camera: MENU → Setup → Media → Format the card.\n"
            "2. Take one ordinary photo so the camera creates DCIM/100MSDCF/.\n"
            "3. Copy every .JPG from this ZIP's DCIM/100MSDCF/ into that folder on the card.\n"
            "4. MOST IMPORTANT: MENU → Setup → Media → Recover Image Database → confirm.\n"
            "   Without this the camera will NOT show the cards.\n"
            "5. Press ▶ Playback and scroll — the pose cards appear among your shots."
        ),
    },
    "canon": {
        "folder": "DCIM/100CANON/",
        "hr": (
            "1. U aparatu: MENU → (alat) → Format card.\n"
            "2. Snimi jednu običnu fotku da aparat napravi DCIM/100CANON/ mapu.\n"
            "3. Kopiraj sve .JPG iz DCIM/100CANON/ ovog ZIP-a u istoimenu mapu na kartici.\n"
            "4. Canon ne treba rebuild baze — ubaci karticu i pritisni ▶ Playback.\n"
            "   (INFO prikazuje dodatne podatke.)"
        ),
        "en": (
            "1. In camera: MENU → (wrench) → Format card.\n"
            "2. Take one ordinary photo so the camera creates DCIM/100CANON/.\n"
            "3. Copy every .JPG from this ZIP's DCIM/100CANON/ into that folder on the card.\n"
            "4. No database rebuild on Canon — insert the card and press ▶ Playback.\n"
            "   (Press INFO to reveal extra details.)"
        ),
    },
    "nikon": {
        "folder": "DCIM/100NCZ_X/",
        "hr": (
            "1. U aparatu: MENU → (alat) → Format memory card.\n"
            "2. Snimi jednu običnu fotku — aparat napravi mapu DCIM/100NCZ_… (npr. 100NCZ_8 za Z8).\n"
            "3. Kopiraj DSC_*.JPG iz ovog ZIP-a u TU mapu koju je tvoj aparat napravio\n"
            "   (NE u 100NCZ_X — to je samo primjer imena).\n"
            "4. Nikon ne treba rebuild baze. Ako kartice ne vidiš:\n"
            "   PLAYBACK MENU → Playback folder → All.\n"
            "5. Pritisni ▶ Playback i listaj."
        ),
        "en": (
            "1. In camera: MENU → (wrench) → Format memory card.\n"
            "2. Take one ordinary photo — the camera creates DCIM/100NCZ_… (e.g. 100NCZ_8 for Z8).\n"
            "3. Copy the DSC_*.JPG from this ZIP into THAT folder your camera made\n"
            "   (NOT 100NCZ_X — that name is just a placeholder).\n"
            "4. No database rebuild on Nikon. If you don't see the cards:\n"
            "   PLAYBACK MENU → Playback folder → All.\n"
            "5. Press ▶ Playback and scroll."
        ),
    },
}


def instructions(vendor: str) -> tuple[str, str]:
    """Return (croatian, english) instruction text for the vendor."""
    info = _INSTRUCTIONS[vendor]
    return info["hr"], info["en"]


def build_zip(designs: list[tuple[str, bytes]], vendor: str, orientation: str = "auto",
              template_dir: str = TEMPLATES_DIR) -> bytes:
    """Convert every design and return a ZIP laid out like an SD card.

    Args:
        designs: list of (original_filename, image_bytes). Order is preserved;
                 cards are numbered DSC09000, DSC09001, ... in that order.
        vendor:  "sony" | "canon" | "nikon".
        orientation: "auto" | "landscape" | "portrait" (applied to every design).
        template_dir: where the bundled vendor templates live.

    Returns:
        ZIP file bytes.
    """
    if vendor not in encoder.VENDORS:
        raise ValueError(f"unknown vendor {vendor!r}")
    if not designs:
        raise ValueError("no designs provided")

    v = encoder.VENDORS[vendor]
    template_path = os.path.join(template_dir, v.template)
    if not os.path.exists(template_path):
        raise FileNotFoundError(
            f"missing template for {vendor}: {template_path} — upload a real "
            f"straight-out-of-camera JPEG named {v.template}"
        )
    qtables, make, model = encoder.template_meta(template_path)

    hr, en = instructions(vendor)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, (_orig_name, image_bytes) in enumerate(designs):
            card = encoder.convert_with(image_bytes, qtables, make, model, orientation)
            arcname = f"DCIM/{v.folder}/{encoder.filename_for(vendor, i)}"
            zf.writestr(arcname, card)
        zf.writestr("PROCITAJ-ME.txt", hr + "\n")
        zf.writestr("README.txt", en + "\n")
    return buf.getvalue()
