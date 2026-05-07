# Sony A7 IV sample build

A pre-built, hardware-confirmed pose card. Use it to verify your camera plays back what we generate before you invest time in the full Canva → cardify pipeline.

## Files

- `DSC00099.JPG` — single landscape pose card. 1920×1280, baseline JPEG, YCbCr 4:2:2, EXIF marked as `SONY ILCE-7M4`, R98 DCF marker, 160×120 embedded thumbnail. ~80 KB.

## Quick test

1. **Download**: open the file on GitHub and click the "Download raw file" button (top right of the file view).
2. **Format an SD card in your camera** (Menu → Setup → Media → Format).
3. **Take one test photo**. Sony writes `DCIM/100MSDCF/DSC00001.JPG`.
4. **Eject the card**, plug into your computer.
5. **Drop our JPG into the same folder**:
   ```bash
   cp ~/Downloads/DSC00099.JPG /Volumes/<your-sd-card>/DCIM/100MSDCF/
   ```
6. **Eject cleanly** (Finder eject button — not just unplug).
7. **Insert into camera, hit Play (▶)**. Scroll past your test photo.

You should see our card. Single-image view zooms cleanly; grid view shows the embedded line-art thumbnail.

## What "working" looks like

- Single-image view: card renders sharp, full-screen, full resolution.
- Zoom (top dial): you can zoom in and read the text.
- Grid view (button next to Play, ⊞ icon): shows the thumbnail of just the line-art illustration.

## What to send back if it doesn't work

Open an issue with:

- A photo of the camera screen (whatever it shows: error message, blank, generic icon, anything).
- The exiftool dump of the file (if you have exiftool installed):
  ```bash
  exiftool -G1 -a -s DSC00099.JPG | head -80
  ```
- Camera model and firmware version.
