# Ad A v7: storyboard

15.0 s · 1080 × 1920 · 30 fps · 450 frames · 120 BPM · three hooks on one body (Meta A/B test)
Code: `src/v7/` (`AdA7.tsx` the body, `Hooks.tsx` H1–H3 and the scene each hands to, `Fan.tsx` the dealt fan). Clock: `src/v7/timeline.json`; music: v4's track on this clock (`python3 scripts/music.py src/v7/timeline.json public/music/ad-a-v7.wav`).
Compositions: `AdA7-H1-9x16`, `AdA7-H2-9x16`, `AdA7-H3-9x16`. Renders in `renders/`.

Why it changed from v4/v6 (the analysis):
- **The pain comes first.** The photographer has to recognise themselves before the product appears.
- **The camera is the answer by 3 s, the real playback by 5 s.** In v6 it came at 13 s, after most viewers had left.
- **One benefit on the card** (the words that relax the couple) instead of a list of three features.
- **The end card answers the questions that stop a click:** what's free, how the card gets into the camera, who made it.
- **The length drops from 21 s to 15 s,** and the end card from 5 s to 3 s.

**1 · Hook** · 0:00–3.0 (the A/B variable). Each caption is on screen from the first frame.
- **H1, pain:** the couple waits, in slow motion. "Your couple is waiting." Then at 1.45 the picture washes out and loses focus: "Your mind goes **blank**."
- **H2, phone:** the same shot. "Still checking your **phone** / in front of the couple?"
- **H3, POV:** v4's hook. "POV: your camera / tells you the / **next pose.**"

**2 · The answer** · 3.0–5.0, a cut on the drop
- **H1 and H2:** the pose card on the camera in her hands. The frame follows the screen as the camera drifts. Caption: "Not on your phone. / In your **camera**."
- **H3:** the couple in the pose, as in v4. Caption: "Glance. Pose. **Shoot.**"

**3 · Playback** · 5.0–8.0
- A thumb swipes card to card on the camera. Caption: "Swipe to the / **next pose**"

**4 · The card** · 8.0–10.0
- The vector Editorial card, whole. At 8.15 it pushes into "Say to the couple": the rest dims and a red outline draws around it.
- Caption: "The exact **words** / to relax your couple"

**5 · The fan** · 10.0–12.0
- The four pack cards are dealt in behind the Editorial card, inner pair first, each landing with a small overshoot. Then they drift apart slowly.
- Caption: "Every pose for / **the whole day**"

**6 · End card** · 12.0–15.0
- The mark and "Shoot Cards by NotaLucis".
- "Your first card / is **free**."
- "Save it to your SD card · open it in playback"
- "Made by wedding photographers / Kim & Ivan · In Principio"
- "Tap **Learn more** to make yours", with the arrow nudging on the beat towards Meta's button.

**Test plan:** run H1, H2 and H3 at the same budget. Compare the hook rate (3-second views ÷ impressions) and the CTR to the landing page. Keep the winner and test new hooks against it.

**Still to shoot** (the strongest material there isn't footage of yet):
- a photographer scrolling a phone while a couple waits,
- Kim or Ivan saying one sentence to camera,
- a card being saved to the SD card.
