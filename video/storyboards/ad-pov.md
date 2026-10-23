# Ad POV (Ad A v3) — storyboard

16.0 s · 1080 × 1920 · 30 fps · 480 frames · 120 BPM (1 beat = 0.5 s = 15 frames)
Code: `src/v3/AdPov.tsx`. Clock shared with the music: `src/v3/timeline.json` → `python3 scripts/music.py src/v3/timeline.json public/music/ad-pov.wav`.
Picked from three hook prototypes (`src/v2/Hooks.tsx`): hook 1, Reels-native.

Look: real footage in every frame, no title cards until the end. Captions are heavy Inter (800) in white with a soft shadow, with red highlight boxes on the key word, and the words snap in 3 frames apart. Every scene change is a hard cut on the beat with an 8 % punch-in. Text stays out of the top 14 % and bottom 35 % (Instagram UI).

**1 · Hook (POV)** — 0:00–3.0, frames 0–90
- On screen: the wedding take, over her shoulder: the pose card on the camera in her hands (clip 0.2 s on, 1×).
- Caption: "POV: your camera / tells you the / [next] [pose.]". It starts a beat early, so "POV:" is on frame 0.
- Music: lowpassed kick pulse and arpeggio from frame 0, riser from 1.5 s.

**2 · The couple** — 3.0–6.0, frames 90–180 (drop)
- On screen: match cut from the card to the couple standing in the pose. Only the sharp end of the take is used (5.55 s on, after the focus pull), slowed to 0.55×. It was shot at 50 fps, so it stays smooth.
- Caption, low in the safe area: "Glance. Pose. [Shoot.]", one word per beat; then "Your phone stays / in your [pocket.]" (4.6 s).

**3 · Playback** — 6.0–8.0, frames 180–240
- On screen: the 4K clip of a thumb scrolling playback (Bruno Weddings cards cut out).
- Caption: "Every pose, right in / your camera’s / [playback.]"

**4 · The words** — 8.0–10.0, frames 240–300
- On screen: macro on The First Look's "Say to the couple" box, sharp from the 27 MP photo, slowly pulling back.
- Caption: "+ the exact [words] / to say to them."

**5 · Works on** — 10.0–12.0, frames 300–360
- On screen: Editorial → Vogue → Fit Check → The First Look, a cut per beat, cards lined up on the same spot, shutter clicks.
- Caption: red plate WORKS ON; "Sony. Canon. [Nikon.]", one word per cut.

**6 · Logo + CTA** — 12.0–16.0, frames 360–480
- On screen: bordo. White mark builds; "Shoot Cards / by NotaLucis". "Never go [blank] / on a shoot again." with a white highlight. White button "Make my free card →" (12.45 s), pressed on the beat at 13.5 s; cards.notalucis.com · First card free · no account.
- CTA readable for 3.5 s.

Total: 3 + 3 + 2 + 2 + 2 + 4 = 16.0 s ✓
