# Shoot Cards — launch video and Meta ads

The launch video and the Instagram/Facebook ads, animated in code with [Remotion](https://www.remotion.dev).
Every frame is a function of the frame number, so a revision is a one-line change in `src/config.ts` and a re-render.
The motion rules come from the `launch-motion` skill (`.claude/skills/launch-motion/`).

- `brief.md`: what the videos must say and show.
- `storyboards/`: scene by scene, with times and frames. The code follows these exactly.
- `source/`: the camera originals (8 photos, the playback-scroll clip).

This folder is not part of the website: `.vercelignore` keeps it out of the deployment.

## Videos

| Composition | Size | fps | Length | For |
|---|---|---|---|---|
| `Launch-16x9` | 1920 × 1080 | 60 | 30 s | website, YouTube |
| `Launch-9x16` | 1080 × 1920 | 60 | 30 s | Reels, Stories |
| `Launch-4x5` | 1080 × 1350 | 60 | 30 s | Feed |
| `AdA-…` "Blank" | 9:16, 4:5 | 30 | 13 s | Meta ads |
| `AdB-…` "No phone" | 9:16, 4:5 | 30 | 13 s | Meta ads |
| `AdC-…` "Who’s next?" | 9:16, 4:5 | 30 | 13 s | Meta ads |
| `AdA2-9x16` "Blank" v2 | 1080 × 1920 | 30 | 16 s | Instagram ad, with music |
| `AdPOV-9x16` "POV" (Ad A v3) | 1080 × 1920 | 30 | 16 s | Instagram ad, with music |

`AdA2` is the rebuild on the Relay motion rules (`.claude/skills/launch-motion/references/relay-motion-skill.md`): real images full-bleed, editorial type, bordo wipes, cut to a 120 BPM track. Its code is in `src/v2/`, its storyboard in `storyboards/ad-a-v2.md`, and picture and music share one clock, `src/v2/timeline.json`.

`AdPOV` (Ad A v3) is built on the strongest of three hook prototypes (`Hook1–3-9x16`, `src/v2/Hooks.tsx`): "POV: your camera tells you the next pose" over the wedding take, Reels-native captions, a hard cut with a punch-in on every beat. Code in `src/v3/`, storyboard in `storyboards/ad-pov.md`, clock in `src/v3/timeline.json`.

## Run it

Needs Node 18+, ffmpeg, and Python 3 with numpy and scipy (for the music).

```bash
cd video
npm install
npm run assets        # photos + clip from source/ → public/ ; text cards from assets/builder.js ; music
npm run studio        # preview and scrub in the browser
npm run render:all    # every video → out/*.mp4 (or: node scripts/render-all.mjs AdA-9x16)
node scripts/stills.mjs Launch-9x16   # key-frame stills + contact sheet → out/stills/
```

In the cloud container, point Remotion at the pre-installed Chromium first:
`export REMOTION_CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.

Remotion is free for individuals and companies of up to 3 people; larger teams need a [company license](https://www.remotion.dev/license).

## Changing things

- Copy, URL, CTA, photos, clip segments, music: `src/config.ts`.
- Scene timing: `LAUNCH` in `src/Launch.tsx`, the `seq([...])` calls in `src/Ads.tsx` (update the storyboard too).
- Brand colours, fonts, easing: `src/theme.ts`.
- Music: `scripts/music.py` composes and synthesises a track (no samples, no licence) on an ad's own clock: `python3 scripts/music.py` for Ad A v2, `python3 scripts/music.py src/v3/timeline.json public/music/ad-pov.wav` for Ad POV. Change a time in the timeline and both picture and music follow. For the other videos, put a licensed track in `public/music/` and set `MUSIC.launch` / `MUSIC.ads` in `config.ts`.
- New footage: put it in `source/`, run `npm run assets` (it becomes H.264 in `public/footage/`), then point `FOOTAGE` or a scene at it.

## Rights

Only cards whose photo credit is In Principio Weddings appear. `source/DSC08437.jpg` (The Almost Kiss) and the Shoulder Touch card are credited to Bruno Weddings, so they are left out (the clip skips 2.30–2.90 s). The other cards in the clip need a check of their credits too. Anyone recognisable in a paid ad needs a signed release, including the couple in `source/wedding-shoot.mov`.
