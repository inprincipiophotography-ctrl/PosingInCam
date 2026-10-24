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

## Revision 2 · pared back (feedback: "too many sounds, it must be elegant and not distracting")

The first round followed the method to the letter: 37 cues, a sound on every movement and event, four risers. It was too busy. This round keeps **9 cues**, only on the moments the story turns on. All of them are 5–10 dB softer, and the music bed carries everything in between (−13 dB instead of −19).

Taken out:
- the callout whooshes and clicks, the callout exit, the tagline whoosh,
- the fan gear ticks, the chip pops,
- the sci-fi sounds (scifi_click, scifi_impact) and the reward sound,
- three of the four risers and two of the three hits,
- the transition whooshes on the cuts at 3 s and 11 s. A quiet shutter carries those instead.

This departs from the method's rule of at least 2 sharp_bass and 2 metallic risers: one riser was enough here.

| id | at | sound | dB | moment |
|---|---|---|---|---|
| W01 | 0.301 | deep_voice_1 | −18 | notification drops in, barely there |
| T01 | 3.00 | digital_camera_click_1 | −16 | cut to the couple: the shutter that took the shot |
| R01 | ends 5.00 | sharp_bass_2 | −16 | the only build, into the body of the ad |
| H01 | 5.00 | impact_1 | −19 | under R01, felt more than heard |
| W02 | 5.266 | deep_voice_3 | −15 | the card rises out of the dark |
| W03 | 9.466 | deep_voice_2 | −17 | the fan opens |
| T02 | 11.00 | digital_camera_click_2 | −18 | cut to the camera, the same shutter, quieter |
| W04 | 13.933 | organic_wind_2 | −17 | into the end card, the airiest whoosh |
| T03 | 14.10 | activate_energy_1 | −15 | the mark appears, one chime |

Whoosh peaks still sit on the fastest frame of their move (`fastest()` on the easing curves in `moves.ts`).

## Mix

- **Raw render:** about −26 LUFS, peaks well under 0 dBFS.
- **Master:** `scripts/master.sh` measures the render, gains it to −14 LUFS, then runs a true-peak limiter. Result: **−14.1 LUFS, −1.9 dBTP**.
- **Loudest moment:** 5.0 s, the riser top and hit. It is about 6 dB above the music for a quarter of a second; this is the one accent.
- **Everywhere else** the sound sits within 0–3 dB of the music.

## To change something

- **A level or a variation:** edit its cue in `src/v5/sound.ts`, re-render, then run `scripts/master.sh out/AdA5-9x16.mp4`. The first-round cue list is in git history (commit 053c15c), if any of it should come back.
- **A timing:** edit `src/v5/timeline.json`. The picture, the whoosh peaks and the bed all follow.
- **Re-synthesising:** `python3 scripts/sfx.py` is deterministic (seed 2026), so the same files come back.
