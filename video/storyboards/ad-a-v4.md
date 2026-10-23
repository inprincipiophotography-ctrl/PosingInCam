# Ad A v4 — storyboard

20.0 s · 1080 × 1920 · 30 fps · 600 frames · 120 BPM
Code: `src/v4/AdA4.tsx`. Clock shared with the music: `src/v4/timeline.json` → `python3 scripts/music.py src/v4/timeline.json public/music/ad-a-v4.wav`.

What changed from v3, and why:
- **One rhythm.** A scene every 6 beats (3 s). The card scene is 12 beats and changes focus every 3 beats. Every cut lands on the beat with a 4.5 % punch-in that settles in half a beat.
- **One caption style, one place.** Heavy white Inter on a dark box per line, the key word in red. Always at the top of Instagram's safe area. One idea per caption.
- **A sharp card.** The pose card is rebuilt as vector UI (`src/v4/PoseCard.tsx`, the exact layout of builder.js). Its words stay sharp at any zoom, instead of zooming into a photo of the camera's LCD.
- **Centred framing.** Every key element sits in the middle of the visible area, between the caption and Instagram's bottom UI.
- **An end card for Meta.** No fake button, because a button in the video can't be tapped. The end card points down at the button Instagram draws under the ad ("Learn more", set in `COPY.metaCta`).

**1 · Hook (POV)** — 0:00–3.0
- The wedding take, over her shoulder: the pose card on the camera in her hands.
- Caption: "POV: your camera / tells you the / [next pose.]". It is already on the first frame.

**2 · The couple** — 3.0–6.0 (drop)
- Match cut to the couple in the pose: only the sharp end of the take, at 0.55× (shot at 50 fps).
- Caption: "Glance. Pose. [Shoot.]"

**3 · The card** — 6.0–12.0
- The card is **Editorial 1/1**: the same card that's on her camera in the hook, so the story runs on. Its photo is cut 1:1 from the camera screen in `source/DSC08438.jpg`, where the card measures 1281 × 1922 px; its words are copied off that screen.
- 6.0: the real photo of that camera (DSC08438), its screen in the middle of the frame.
- 6.3: the photographed screen swaps for the vector card, with a shutter click.
- 6.5–7.4: the card lifts off the screen. A tilt settles, a shadow grows, and the camera behind falls out of focus and darkens. Caption: "On every card:".
- From 7.6 a spotlight dims the card except for the part being explained. The bright cut-out glides from part to part with the camera.
- 7.6: push to the photo, and a red outline draws around it: "The [pose] to copy".
- 9.0: push to the "Say to the couple" box, sharp at 1.18×: "The exact [words] / to say to them".
- 10.5: push to the camera settings and the hack: "Settings + a [hack]".

**4 · Playback** — 12.0–15.0
- The 4K clip of a thumb scrolling playback, the camera screen centred (Bruno Weddings cards cut out).
- Caption: "Every pose for the day, / right in [playback]"

**5 · End card** — 15.0–20.0
- Bordo. The mark builds, then "Shoot Cards / by NotaLucis".
- "Never go [blank] / on a shoot again.", then "Your first card is free." and "No account · Sony · Canon · Nikon".
- At the foot of the safe area: "Tap [Learn more] to make yours" with an arrow that nudges down on every beat, towards Meta's button.
- Readable for 4 s or more.

**Music**
- From frame 0: lowpassed kick pulse and arpeggio, riser from 1.5 s.
- 3.0 s: drop with an impact.
- Whooshes on the lift and each push, a shutter click on the screen swap.
- 15.0 s: impact into an Fmaj9 pad.
- Mastered to −14 LUFS.
