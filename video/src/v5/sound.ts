import type { Cue } from "./Sfx";
import { fastest } from "./Sfx";
import { MOVES } from "./moves";
import TL from "./timeline.json";

// Ad A v5 cue sheet, Ultimate Editors method, pared back to stay elegant: nine sounds, each on a moment the
// story turns on, all soft, the music bed carrying everything in between. Breakdown: storyboards/ad-a-v5-sound.md.
//   WHOOSHES  peak on the fastest frame of the eased move (fastest()); −15 to −18 dB.
//   TEXTURES  on the event frame; −12 to −15 dB.
//   RISERS    one, ending on the cut into the body of the ad, a soft hit underneath.
// One family per track; masterDb moves everything, bedDb the music bed.
const pk = (m: { from: number; dur: number; easing: (t: number) => number }) => fastest(m.from, m.dur, m.easing);
const r2 = (s: number) => Math.round(s * 1000) / 1000;
const LEAD = 2 / 30; // a transition whoosh peaks 2 frames before the cut it carries

const whooshes: Cue[] = ([
  { id: "W01", file: "sfx/whooshes/deep_voice_1.wav", at: pk(MOVES.notifySlide), db: -18, note: "notification drops in; barely there, a breath" },
  { id: "W02", file: "sfx/whooshes/deep_voice_3.wav", at: pk(MOVES.cardRise), db: -15, note: "the card rises out of the dark: the one big move" },
  { id: "W03", file: "sfx/whooshes/deep_voice_2.wav", at: pk(MOVES.fan), db: -17, note: "the fan opens" },
  { id: "W04", file: "sfx/whooshes/organic_wind_2.wav", at: TL.end.from - LEAD, db: -17, note: "into the end card; the softest, airiest variation" },
] as Cue[]).map((c) => ({ ...c, at: r2(c.at) }));

const textures: Cue[] = [
  { id: "T01", file: "sfx/textures/digital_camera_click_1.wav", at: TL.couple.from, db: -16, note: "cut to the couple: the shutter that took the shot" },
  { id: "T02", file: "sfx/textures/digital_camera_click_2.wav", at: TL.playback.from, db: -18, note: "cut to the camera, the same shutter, quieter" },
  { id: "T03", file: "sfx/textures/activate_energy_1.wav", at: TL.end.logo, db: -15, note: "the mark appears: a single chime" },
];

const risers: Cue[] = [
  { id: "R01", file: "sfx/risers/sharp_bass_2.wav", at: TL.card.from, db: -16, note: "the only build: out of the hook into the body of the ad" },
];

const hits: Cue[] = [
  { id: "H01", file: "sfx/hits/impact_1.wav", at: TL.card.from, db: -19, note: "under R01, felt more than heard" },
];

export const SOUND = { whooshes, textures, risers, hits, masterDb: 0, bedDb: -13 };
