import React from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import manifest from "../sfx-manifest.json";

// Sound design on the timeline (Ultimate Editors method): one family per track, every sound a whole, separate
// clip that can be slid or swapped in Remotion Studio. A cue names the moment it serves; the clip is placed so
// the sound's own alignment point (whoosh peak, texture transient, riser top: see scripts/sfx.py) lands on it.

export type Cue = {
  id: string; // W01, T03, R02 …
  file: keyof typeof manifest;
  at: number; // seconds: the frame the sound must hit
  db: number; // level relative to full scale
  note: string; // what it emphasises, and why this variation
};

export const dbToGain = (db: number) => Math.pow(10, db / 20);

export const SfxTrack: React.FC<{ name: string; cues: Cue[]; masterDb?: number }> = ({ name, cues, masterDb = 0 }) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence name={name} layout="none">
      {cues.map((c) => {
        const m = manifest[c.file];
        const from = Math.round((c.at - m.align) * fps);
        return (
          <Sequence key={c.id} name={`${c.id} ${m.sound}_${m.variation} · ${c.db} dB`} from={from} durationInFrames={Math.ceil(m.duration * fps) + 1} layout="none">
            <Audio src={staticFile(c.file)} volume={dbToGain(c.db + masterDb)} />
          </Sequence>
        );
      })}
    </Sequence>
  );
};

/** The fastest moment of an eased move (seconds), where a whoosh's peak belongs. */
export function fastest(from: number, dur: number, easing: (t: number) => number) {
  let best = 0;
  let at = 0;
  for (let i = 1; i <= 200; i++) {
    const t0 = (i - 1) / 200;
    const t1 = i / 200;
    const v = Math.abs(easing(t1) - easing(t0));
    if (v > best) {
      best = v;
      at = (t0 + t1) / 2;
    }
  }
  return from + at * dur;
}
