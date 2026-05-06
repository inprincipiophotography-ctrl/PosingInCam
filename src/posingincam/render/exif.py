"""Embed EXIF metadata + 1st-IFD thumbnail into a JPEG byte string.

The tag set here is matched against what real Sony JPEGs contain (and what
Cue's reference samples ship), minus Sony-proprietary MakerNotes which we
don't synthesize. See docs/CUE_EXIF_ANALYSIS.md.

Layout:
- 0th IFD:    Make, Model, Software, Orientation, resolutions, dates,
              ImageDescription marker, YCbCrPositioning.
- Exif IFD:   ExifVersion, FlashpixVersion, ColorSpace,
              ComponentsConfiguration, PixelXDimension/PixelYDimension,
              plausible shooting params (ExposureTime, FNumber, ISO, ...),
              scene/lens/exposure metadata.
- Interop:    R98 marker (DCF basic file) + version 0100. Required for
              full DCF compliance; many camera firmwares look for this.
- 1st IFD:    Thumbnail metadata + Make/Model/Software so the thumb IFD
              parallels what cameras write.
- Thumbnail:  160x120 JPEG (line-art only, no text). What cameras show
              in grid view.
"""

from __future__ import annotations

from io import BytesIO
from typing import Any, cast

import piexif

from posingincam.cameras.profile import CameraProfile
from posingincam.pose.schema import Pose

# Tag IDs not exposed by piexif's named constants; we use the standard EXIF
# IDs directly. See https://exiftool.org/TagNames/EXIF.html.
INTEROP_VERSION_TAG = 0x0002

# piexif's TAGS table is missing the InteroperabilityVersion entry (tag 2)
# that real cameras and Cue ship. Register it once on import so piexif.dump
# can serialize it.
if INTEROP_VERSION_TAG not in piexif.TAGS["Interop"]:
    piexif.TAGS["Interop"][INTEROP_VERSION_TAG] = {
        "name": "InteroperabilityVersion",
        "type": piexif.TYPES.Undefined,
    }


def build_exif_bytes(
    profile: CameraProfile,
    pose: Pose,
    thumbnail_jpeg: bytes,
    image_width: int,
    image_height: int,
) -> bytes:
    image_description = f"posingincam:{pose.id}:v{pose.version}"
    user_comment = (
        f"posingincam pose {pose.id} ({pose.slug}) for {profile.id}; "
        f"see github.com/inprincipiophotography-ctrl/posingincam"
    )
    dt = profile.exif.date_time_original.encode("ascii")

    zeroth = {
        piexif.ImageIFD.Make: profile.exif.make.encode("ascii"),
        piexif.ImageIFD.Model: profile.exif.model.encode("ascii"),
        piexif.ImageIFD.Software: profile.exif.software.encode("ascii"),
        piexif.ImageIFD.Orientation: 1,
        piexif.ImageIFD.ImageDescription: image_description.encode("ascii"),
        piexif.ImageIFD.XResolution: (350, 1),
        piexif.ImageIFD.YResolution: (350, 1),
        piexif.ImageIFD.ResolutionUnit: 2,  # inches
        piexif.ImageIFD.YCbCrPositioning: 1,  # Centered
        piexif.ImageIFD.DateTime: dt,
    }

    exif_ifd = {
        # Versioning
        piexif.ExifIFD.ExifVersion: b"0232",
        piexif.ExifIFD.FlashpixVersion: b"0100",
        # Image metadata
        piexif.ExifIFD.ColorSpace: 1,  # sRGB
        piexif.ExifIFD.ComponentsConfiguration: b"\x01\x02\x03\x00",  # Y, Cb, Cr, -
        piexif.ExifIFD.PixelXDimension: image_width,
        piexif.ExifIFD.PixelYDimension: image_height,
        # Date/time
        piexif.ExifIFD.DateTimeOriginal: dt,
        piexif.ExifIFD.DateTimeDigitized: dt,
        # Marker for our tooling — Lightroom users can filter these out.
        piexif.ExifIFD.UserComment: b"ASCII\x00\x00\x00" + user_comment.encode("ascii"),
        # Plausible synthetic shooting params (cameras want these populated).
        piexif.ExifIFD.ExposureTime: (1, 50),
        piexif.ExifIFD.FNumber: (0, 1),
        piexif.ExifIFD.ExposureProgram: 1,  # Manual
        piexif.ExifIFD.ISOSpeedRatings: 12800,
        piexif.ExifIFD.SensitivityType: 2,  # Recommended Exposure Index
        piexif.ExifIFD.RecommendedExposureIndex: 12800,
        piexif.ExifIFD.MaxApertureValue: (0, 1),
        piexif.ExifIFD.MeteringMode: 5,  # Multi-segment
        piexif.ExifIFD.LightSource: 0,  # Unknown
        piexif.ExifIFD.Flash: 16,  # Off, did not fire
        piexif.ExifIFD.FocalLength: (0, 1),
        piexif.ExifIFD.FocalLengthIn35mmFilm: 0,
        piexif.ExifIFD.FileSource: b"\x03",  # Digital camera
        piexif.ExifIFD.SceneType: b"\x01",  # Directly photographed
        piexif.ExifIFD.CustomRendered: 0,  # Normal
        piexif.ExifIFD.ExposureMode: 1,  # Manual
        piexif.ExifIFD.WhiteBalance: 0,  # Auto
        piexif.ExifIFD.DigitalZoomRatio: (1, 1),
        piexif.ExifIFD.SceneCaptureType: 0,  # Standard
        piexif.ExifIFD.Contrast: 0,  # Normal
        piexif.ExifIFD.Saturation: 0,  # Normal
        piexif.ExifIFD.Sharpness: 0,  # Normal
        piexif.ExifIFD.LensModel: b"----",
    }

    # Interop IFD: R98 = DCF basic file (sRGB). Many camera firmwares look
    # for this exact marker before treating a file as a DCF "basic file".
    interop = {
        piexif.InteropIFD.InteroperabilityIndex: b"R98",
        INTEROP_VERSION_TAG: b"0100",
    }

    first_ifd = {
        # Thumbnail compression + resolution (piexif fills offset/length).
        piexif.ImageIFD.Compression: 6,  # JPEG
        piexif.ImageIFD.Orientation: 1,
        piexif.ImageIFD.XResolution: (72, 1),
        piexif.ImageIFD.YResolution: (72, 1),
        piexif.ImageIFD.ResolutionUnit: 2,
        # Cameras populate Make/Model/Software/Date in the thumbnail IFD too.
        piexif.ImageIFD.Make: profile.exif.make.encode("ascii"),
        piexif.ImageIFD.Model: profile.exif.model.encode("ascii"),
        piexif.ImageIFD.Software: profile.exif.software.encode("ascii"),
        piexif.ImageIFD.DateTime: dt,
        piexif.ImageIFD.YCbCrPositioning: 1,
    }

    exif_dict: dict[str, Any] = {
        "0th": zeroth,
        "Exif": exif_ifd,
        "GPS": {},
        "Interop": interop,
        "1st": first_ifd,
        "thumbnail": thumbnail_jpeg,
    }

    return cast(bytes, piexif.dump(exif_dict))


def embed_exif(jpeg_bytes: bytes, exif_bytes: bytes) -> bytes:
    """Insert/replace the EXIF segment in a JPEG byte string."""
    out = BytesIO()
    piexif.insert(exif_bytes, jpeg_bytes, out)
    return out.getvalue()
