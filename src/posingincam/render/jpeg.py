"""PNG bytes -> JPEG bytes via Pillow."""

from __future__ import annotations

from io import BytesIO

from PIL import Image
from PIL.Image import Image as PILImage


def png_to_jpeg_bytes(png_bytes: bytes, quality: int = 85) -> bytes:
    """Decode PNG, flatten on white, encode JPEG at the given quality."""
    src: PILImage = Image.open(BytesIO(png_bytes))
    img: PILImage
    if src.mode in ("RGBA", "LA"):
        img = Image.new("RGB", src.size, (255, 255, 255))
        img.paste(src, mask=src.split()[-1])
    elif src.mode != "RGB":
        img = src.convert("RGB")
    else:
        img = src

    buf = BytesIO()
    img.save(
        buf,
        format="JPEG",
        quality=quality,
        optimize=True,
        progressive=False,
        subsampling="4:2:0",
    )
    return buf.getvalue()
