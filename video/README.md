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
| `AdA4-9x16` Ad A v4 | 1080 × 1920 | 30 | 19 s | Instagram ad, with music |
| `AdA5-9x16` Ad A v5 "Dark glass" | 1080 × 1920 | 30 | 18.5 s | Instagram ad, sound design + music bed |

`AdA2` is the rebuild on the Relay motion rules (`.claude/skills/launch-motion/references/relay-motion-skill.md`): real images full-bleed, editorial type, bordo wipes, cut to a 120 BPM track. Its code is in `src/v2/`, its storyboard in `storyboards/ad-a-v2.md`, and picture and music share one clock, `src/v2/timeline.json`.

`AdPOV` (Ad A v3) is built on the strongest of three hook prototypes (`Hook1–3-9x16`, `src/v2/Hooks.tsx`): "POV: your camera tells you the next pose" over the wedding take, Reels-native captions, a hard cut with a punch-in on every beat. Code in `src/v3/`, storyboard in `storyboards/ad-pov.md`, clock in `src/v3/timeline.json`.

`AdA4` (Ad A v4) keeps the POV hook and fixes the rest: one 3-second rhythm, one caption style in one place, the pose card rebuilt as vector UI (`src/v4/PoseCard.tsx`, builder.js's exact layout) so its words stay sharp at any zoom, centred framing, and an end card that points at Meta's own button instead of drawing a fake one. Code in `src/v4/`, storyboard in `storyboards/ad-a-v4.md`, clock in `src/v4/timeline.json`. `CardPreview` renders the vector card at 1280 × 1920 to check it against the real card. The final v4 render is kept in `renders/AdA4-9x16.mp4`.

`AdA5` (Ad A v5, "Dark glass") is built on the inspiration in `inspo/`: frosted glass UI over the footage and on a near-black stage, white Inter with one italic serif word, all in NotaLucis red. Code in `src/v5/`, storyboard in `storyboards/ad-a-v5.md`, clock in `src/v5/timeline.json`, mastered render in `renders/AdA5-9x16.mp4`.

### Sound design (v5)

Built on the Ultimate Editors method; the full breakdown and per-pass report is in `storyboards/ad-a-v5-sound.md`.
- `scripts/sfx.py` synthesises the library (no samples, no licence): whooshes, textures, risers and hits, three variations each, into `public/sfx/`. `src/sfx-manifest.json` records each file's length and its alignment point (whoosh peak, transient, riser top).
- `src/v5/sound.ts` is the cue sheet: one list per family, each cue = the moment it serves, the file, the level in dB, and why. `src/v5/moves.ts` holds every movement's timing, so the picture and the whoosh peaks read the same numbers.
- In Remotion Studio each family is its own track (`WHOOSHES`, `TEXTURES`, `RISERS`, `HITS`, `MUSIC (bed)`), each sound its own clip named with its id, variation and level.
- Levels: `masterDb` moves everything, `bedDb` the music bed (−13 dB, `python3 scripts/music.py src/v5/timeline.json public/music/ad-a-v5.wav`, pad and arpeggio only).
- After rendering, `scripts/master.sh out/AdA5-9x16.mp4` measures the render and brings it to −14 LUFS through a true-peak limiter (video copied, not re-encoded).

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
