"""Contact sheet of one carousel set: renders/carousel/<set>/NN.jpg → renders/carousel/<set>.jpg (5 per row)."""
import glob, os, sys
from PIL import Image

d = sys.argv[1].rstrip("/")
files = sorted(glob.glob(os.path.join(d, "[0-9][0-9].jpg")))
ims = [Image.open(f) for f in files]
w, h = ims[0].size
s = 0.3
tw, th, gap = int(w * s), int(h * s), 16
cols = min(5, len(ims))
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw + (cols + 1) * gap, rows * th + (rows + 1) * gap), (40, 40, 40))
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (gap + (i % cols) * (tw + gap), gap + (i // cols) * (th + gap)))
sheet.save(d + ".jpg", quality=88)
print(f"  {os.path.relpath(d)}.jpg  ({len(ims)} slides, {w}×{h})")
