# Ad A v5: sound design

Method: Ultimate Editors sound design training. The library is synthesised (`scripts/sfx.py`), because the original is not available.
- **Cue sheet:** `src/v5/sound.ts`, with `SfxTrack` in `src/v5/Sfx.tsx`.
- **Placement:** each clip is placed so that its alignment point lands exactly on the target frame. That point is the whoosh peak, the texture transient or the riser top, recorded in `src/sfx-manifest.json`.
- **Studio:** one family per track: WHOOSHES, TEXTURES, RISERS, HITS, MUSIC (bed). Each clip is named `<id> <sound>_<variation> · <dB>`.

Departure from the method: it asks for approval after every pass. All four passes were done in one round and are reported below; send corrections per pass or per cue id.

## Step 1 · Breakdown

| Time | Type | What happens |
|---|---|---|
| 0.30 | MOVEMENT | notification slides down |
| 0.60 | EVENT | notification lands |
| 3.00 | BUILD → cut | hook → couple |
| 5.00 | BUILD → cut | couple → card stage (into the body of the ad) |
| 5.00–5.80 | MOVEMENT | card rises out of the dark |
| 5.80 | EVENT | card settles |
| 6.10 / 6.90 / 7.70 | MOVEMENT | callouts slide in |
| 6.40 / 7.20 / 8.00 | EVENT | callouts land, connector lines draw |
| 8.95–9.20 | MOVEMENT | callouts leave |
| 9.20–10.00 | MOVEMENT | card to centre, fan opens |
| 9.55–9.85 | EVENT | four fan cards land |
| 11.00 | BUILD → cut | card → playback |
| 12.30 / 12.40 / 12.50 | EVENT | chips pop |
| 14.00 | BUILD → cut | playback → end card |
| 14.10 | EVENT | the mark appears |
| 14.45 | MOVEMENT | tagline rises |
| 15.00 | EVENT | the offer |
| 15.50 | EVENT | "Tap Learn more" |

## Pass 1 · WHOOSHES (movement), −12 dB, −10/−11 for big moves

Each peak sits on the fastest frame of its move. `fastest()` finds that frame from the same easing curve the picture uses (`moves.ts`).
- With the overshoot ease, the fastest frame is the very start of the move.
- With the camera ease, it is the middle.
- With the exit ease, it is the end.
- Transition whooshes peak 2 frames before the cut they carry.

| id | at | sound | dB | why |
|---|---|---|---|---|
| W01 | 0.301 | deep_voice_1 | −12 | notification drop; the shortest deep whoosh, as it is the first sound |
| W02 | 2.933 | synthetic_transition_1 | −11 | hook → couple |
| W03 | 5.266 | deep_voice_3 | −10 | card rise, the biggest move: the longest, heaviest variation |
| W04–06 | 6.101 / 6.901 / 7.701 | hollow_1 / 2 / 3 | −12 | the three callouts, a different variation each so they don't repeat |
| W07 | 9.199 | short_2 | −12 | callouts leave, a fast exit |
| W08 | 9.466 | deep_voice_2 | −11 | card to centre and the fan |
| W09 | 10.933 | synthetic_transition_2 | −11 | card → playback |
| W10 | 13.933 | synthetic_transition_3 | −11 | playback → end, the longest transition |
| W11 | 14.451 | short_1 | −12 | tagline |

Not whooshed: the chips' small scale-in (a pop carries it), the end drift (too slow to read as movement), and the per-frame float of the card.

## Pass 2 · TEXTURES (events), −6 to −9 dB

| id | at | sound | dB | why |
|---|---|---|---|---|
| T01 | 0.60 | ui_click_1 | −7 | notification lands |
| T02 | 3.00 | digital_camera_click_1 | −6 | cut to the couple: the shutter that took the shot |
| T03 | 5.00 | activate_energy_1 | −8 | the card scene powers on |
| T04 | 5.80 | scifi_click_2 | −7 | card settles |
| T05–07 | 6.40 / 7.20 / 8.00 | ui_click_1 / 2 / 3 | −8 | callouts land |
| T08–11 | 9.55–9.85 | gears_1 / 2 / 3 / 1 | −9 | fan cards land, a ratchet tick each, 3 frames apart |
| T12 | 11.00 | digital_camera_click_2 | −6 | cut to the camera |
| T13–15 | 12.30 / 12.40 / 12.50 | pop_1 / 2 / 3 | −8 | Sony, Canon, Nikon |
| T16 | 14.10 | scifi_impact_1 | −7 | the mark appears |
| T17 | 15.00 | success_reward_1 | −7 | the offer: first card free |
| T18 | 15.50 | ui_click_3 | −9 | "Tap Learn more" |

## Pass 3 · RISERS (−5 dB) + HITS

Every riser ends exactly on its transition frame, with a hit underneath. The first big riser ends at 5.0 s, where the ad moves from the hook into its body. The set uses two sharp_bass and two metallic risers.

| id | ends at | sound | dB | hit under it |
|---|---|---|---|---|
| R01 | 3.00 | metallic_1 (1.5 s) | −6 | (camera click T02) |
| R02 | 5.00 | sharp_bass_2 (2.0 s) | −5 | H01 impact_1, −8 |
| R03 | 11.00 | metallic_2 (2.0 s) | −5 | H02 impact_2, −10 |
| R04 | 14.00 | sharp_bass_3 (2.6 s) | −5 | H03 impact_3, −8 |

## Pass 4 · MUSIC bed, −19 dB

`music.py` in bed mode plays an Fmaj9 pad and an arpeggio on the ad's clock: no drums, no bass, no riser, no sidechain. It sits under the sound design so the SFX carry the rhythm.

## Mix and loudest stack

- **Raw render:** −19.2 LUFS integrated, peak −1.6 dBFS. Nothing clips.
- **Loudest stack:** **11.0 s**, about −3.3 dBFS. That is R03 metallic_2 at its top, plus H02 impact, the T12 camera click and the W09 whoosh tail. It is louder than the 5.0 s stack (≈ −4.9 dBFS), because the metallic riser is brighter. To calm it, take H02 down further or move T12 to −8.
- **Master:** `scripts/master.sh` applies +5.5 dB into a true-peak limiter (ceiling −2 dBFS). The result is **−14.3 LUFS, −1.4 dBTP**, video stream copied untouched. The limiter only shaves the click and hit transients.

## To change something

- **A level or a variation:** edit its cue in `src/v5/sound.ts`, re-render, then run `scripts/master.sh out/AdA5-9x16.mp4`.
- **A timing:** edit `src/v5/timeline.json`. The picture, the whoosh peaks and the bed all follow.
- **Re-synthesising:** `python3 scripts/sfx.py` is deterministic (seed 2026), so the same files come back.
