# Camera-in-the-Loop Test Protocol

Use this checklist when promoting a camera profile from "drafted" to Tier 1 or Tier 2.

## Prep

- [ ] Camera firmware noted (e.g. Sony A7 IV firmware 3.01).
- [ ] SD card freshly formatted **in the camera** (not on a computer). FAT32 or exFAT per camera default.
- [ ] Camera battery > 50%.
- [ ] Camera date set to current date (so our cards' frozen 2000-01-01 dates sort distinctly).

## Build

```
posingincam build --camera <camera-id> --pack essential --out /tmp/test-<camera-id>
```

- [ ] No errors.
- [ ] Output tree present at `/tmp/test-<camera-id>/DCIM/<NNN><folder-tag>/`.
- [ ] Folder name matches the camera's convention.
- [ ] Filenames match the camera's prefix and are sequential.
- [ ] At least one file opens correctly in Preview/system viewer (sanity check).

## Copy to card

```
posingincam install --camera <camera-id> --target /Volumes/<sd-card>
```

- [ ] Or copy `/tmp/test-<camera-id>/DCIM/` onto card root with Finder/Explorer.
- [ ] Eject card cleanly.

## Camera-side verification

- [ ] Insert card. Camera mounts without error.
- [ ] Switch to playback mode. Cards appear.
- [ ] **Single-image view**: full card renders at full resolution. Text is sharp, illustration is clean.
- [ ] **Zoom in to 100%**: text is legible, no rendering artifacts.
- [ ] **Grid view (4x4 or 9x9 thumbnails)**: each thumbnail shows the line illustration only — no text bleed-through, no fallback to white square.
- [ ] **Forward/back navigation** between cards is smooth (no multi-second loads).
- [ ] **Switch to shoot mode**, take a real photo, switch back to playback. The new photo and the cards coexist correctly. Cards are not renumbered or moved.
- [ ] Card metadata (Make/Model/date) shows as expected when viewing image info.

## Result archival

For each tested camera, record:

- Camera body and firmware.
- Test date.
- Pass/fail per checklist item.
- Photo of the camera's screen showing a card in playback (single view + grid view).
- Any quirks.

Add to `docs/CAMERA_TEST_RESULTS.md` (created when the first profile is tested).

## Failure triage

If any item fails:

1. Check `exiftool` output on the failing file vs a real camera-shot file from the same body. Diff the EXIF.
2. Try toggling `exif.spoof_make_model` in the profile.
3. Try the next-smallest standard JPEG dimensions for that camera (e.g. drop from L to M size).
4. Try removing the embedded thumbnail to confirm if the camera is generating its own from the full image.
5. If the camera is from a vendor we haven't tested, escalate to a profile-design discussion before shipping.
