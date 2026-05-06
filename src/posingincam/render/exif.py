"""Embed EXIF metadata + 1st-IFD thumbnail into a JPEG byte string.

We use piexif. The 1st IFD holds the embedded thumbnail JPEG that cameras
prefer for grid view. The 0th IFD carries Make, Model, Software, etc.
The Exif sub-IFD carries DateTimeOriginal and the user-comment marker.
"""

from __future__ import annotations

from io import BytesIO
from typing import Any, cast

import piexif

from posingincam.cameras.profile import CameraProfile
from posingincam.pose.schema import Pose


def build_exif_bytes(
    profile: CameraProfile,
    pose: Pose,
    thumbnail_jpeg: bytes,
) -> bytes:
    image_description = f"posingincam:{pose.id}:v{pose.version}"
    user_comment = (
        f"posingincam pose {pose.id} ({pose.slug}) for {profile.id}; "
        f"see github.com/inprincipiophotography-ctrl/posingincam"
    )

    exif_dict: dict[str, Any] = {
        "0th": {
            piexif.ImageIFD.Make: profile.exif.make.encode("ascii"),
            piexif.ImageIFD.Model: profile.exif.model.encode("ascii"),
            piexif.ImageIFD.Software: profile.exif.software.encode("ascii"),
            piexif.ImageIFD.Orientation: 1,
            piexif.ImageIFD.ImageDescription: image_description.encode("ascii"),
            piexif.ImageIFD.XResolution: (72, 1),
            piexif.ImageIFD.YResolution: (72, 1),
            piexif.ImageIFD.ResolutionUnit: 2,
            piexif.ImageIFD.DateTime: profile.exif.date_time_original.encode("ascii"),
        },
        "Exif": {
            piexif.ExifIFD.DateTimeOriginal: profile.exif.date_time_original.encode("ascii"),
            piexif.ExifIFD.DateTimeDigitized: profile.exif.date_time_original.encode("ascii"),
            piexif.ExifIFD.ColorSpace: 1,  # sRGB
            piexif.ExifIFD.UserComment: b"ASCII\x00\x00\x00" + user_comment.encode("ascii"),
        },
        "GPS": {},
        "1st": {
            piexif.ImageIFD.Compression: 6,  # JPEG
            piexif.ImageIFD.XResolution: (72, 1),
            piexif.ImageIFD.YResolution: (72, 1),
            piexif.ImageIFD.ResolutionUnit: 2,
        },
        "thumbnail": thumbnail_jpeg,
    }

    return cast(bytes, piexif.dump(exif_dict))


def embed_exif(jpeg_bytes: bytes, exif_bytes: bytes) -> bytes:
    """Insert/replace the EXIF segment in a JPEG byte string."""
    out = BytesIO()
    piexif.insert(exif_bytes, jpeg_bytes, out)
    return out.getvalue()
