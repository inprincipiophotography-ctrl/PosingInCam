import type { Cue } from "./Sfx";
import { fastest } from "./Sfx";
import { FAN_STAGGER, MOVES, fanLand } from "./moves";
import TL from "./timeline.json";

// Ad A v5 cue sheet, Ultimate Editors method. Breakdown and per-pass reports: storyboards/ad-a-v5-sound.md.
//   WHOOSHES  every movement; the peak sits on the fastest frame of the eased move (fastest()); −12 dB, −10 for big moves.
//   TEXTURES  every non-slide event, on the event frame; −6/−8 dB.
//   RISERS    end exactly on a transition frame, a hit underneath; −5 dB.
//   HITS      under the risers.
// One family per track; to change a level, change it here (masterDb moves everything, bedDb the music bed).
const pk = (m: { from: number; dur: number; easing: (t: number) => number }) => fastest(m.from, m.dur, m.easing);
const r2 = (s: number) => Math.round(s * 1000) / 1000;
const LEAD = 2 / 30; // a transition whoosh peaks 2 frames before the cut it carries

const whooshes: Cue[] = ([
  { id: "W01", file: "sfx/whooshes/deep_voice_1.wav", at: pk(MOVES.notifySlide), db: -12, note: "notification drops in over the footage; short and soft, it is the first sound" },
  { id: "W02", file: "sfx/whooshes/synthetic_transition_1.wav", at: TL.couple.from - LEAD, db: -11, note: "hook → couple cut, the riser hands over to it" },
  { id: "W03", file: "sfx/whooshes/deep_voice_3.wav", at: pk(MOVES.cardRise), db: -10, note: "the card rises out of the dark: the biggest move, the longest, heaviest variation" },
  ...MOVES.callouts.map((m, i): Cue => ({ id: `W0${4 + i}`, file: `sfx/whooshes/hollow_${i + 1}.wav` as Cue["file"], at: pk(m), db: -12, note: `callout ${i + 1} slides in; hollow_${i + 1} so the three don't repeat` })),
  { id: "W07", file: "sfx/whooshes/short_2.wav", at: pk(MOVES.calloutsOut), db: -12, note: "callouts leave; fast exit, short whoosh" },
  { id: "W08", file: "sfx/whooshes/deep_voice_2.wav", at: pk(MOVES.fan), db: -11, note: "card shrinks to centre, the fan opens" },
  { id: "W09", file: "sfx/whooshes/synthetic_transition_2.wav", at: TL.playback.from - LEAD, db: -11, note: "card → playback cut" },
  { id: "W10", file: "sfx/whooshes/synthetic_transition_3.wav", at: TL.end.from - LEAD, db: -11, note: "playback → end cut, longest transition into the close" },
  { id: "W11", file: "sfx/whooshes/short_1.wav", at: pk(MOVES.tagline), db: -12, note: "tagline rises" },
] as Cue[]).map((c) => ({ ...c, at: r2(c.at) }));

const textures: Cue[] = ([
  { id: "T01", file: "sfx/textures/ui_click_1.wav", at: TL.hook.notify + 0.3, db: -7, note: "notification lands" },
  { id: "T02", file: "sfx/textures/digital_camera_click_1.wav", at: TL.couple.from, db: -6, note: "cut to the couple: the shutter that took the shot" },
  { id: "T03", file: "sfx/textures/activate_energy_1.wav", at: TL.card.from, db: -8, note: "the card scene powers on (chime on the cut)" },
  { id: "T04", file: "sfx/textures/scifi_click_2.wav", at: TL.card.rise[1], db: -7, note: "card settles" },
  ...TL.card.callouts.map((at, i): Cue => ({ id: `T0${5 + i}`, file: `sfx/textures/ui_click_${(i % 3) + 1}.wav` as Cue["file"], at: at + 0.3, db: -8, note: `callout ${i + 1} lands, connector draws` })),
  ...[0, 1, 2, 3].map((k): Cue => ({ id: `T${String(8 + k).padStart(2, "0")}`, file: `sfx/textures/gears_${(k % 3) + 1}.wav` as Cue["file"], at: fanLand(k), db: -9, note: `fan card ${k + 1} lands (${FAN_STAGGER * 30} frames apart)` })),
  { id: "T12", file: "sfx/textures/digital_camera_click_2.wav", at: TL.playback.from, db: -6, note: "cut to the camera" },
  ...[0, 1, 2].map((k): Cue => ({ id: `T${13 + k}`, file: `sfx/textures/pop_${k + 1}.wav` as Cue["file"], at: TL.playback.chips + k * 0.1, db: -8, note: `chip ${["Sony", "Canon", "Nikon"][k]} pops` })),
  { id: "T16", file: "sfx/textures/scifi_impact_1.wav", at: TL.end.logo, db: -7, note: "the mark appears on the orb" },
  { id: "T17", file: "sfx/textures/success_reward_1.wav", at: TL.end.offer, db: -7, note: "the offer: first card free" },
  { id: "T18", file: "sfx/textures/ui_click_3.wav", at: TL.end.tap, db: -9, note: "“Tap Learn more” appears" },
] as Cue[]).map((c) => ({ ...c, at: r2(c.at) }));

const risers: Cue[] = [
  { id: "R01", file: "sfx/risers/metallic_1.wav", at: TL.couple.from, db: -6, note: "short build out of the hook into the couple" },
  { id: "R02", file: "sfx/risers/sharp_bass_2.wav", at: TL.card.from, db: -5, note: "first big riser, ~5 s in: into the body of the ad" },
  { id: "R03", file: "sfx/risers/metallic_2.wav", at: TL.playback.from, db: -5, note: "into playback" },
  { id: "R04", file: "sfx/risers/sharp_bass_3.wav", at: TL.end.from, db: -5, note: "longest build, into the end card" },
];

const hits: Cue[] = [
  { id: "H01", file: "sfx/hits/impact_1.wav", at: TL.card.from, db: -8, note: "under R02" },
  { id: "H02", file: "sfx/hits/impact_2.wav", at: TL.playback.from, db: -10, note: "under R03, lighter" },
  { id: "H03", file: "sfx/hits/impact_3.wav", at: TL.end.from, db: -8, note: "under R04" },
];

export const SOUND = { whooshes, textures, risers, hits, masterDb: 0, bedDb: -19 };
