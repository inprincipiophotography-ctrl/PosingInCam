import { Easing, interpolate } from "remotion";
import TL from "./timeline.json";

// Relay motion rules (.claude/skills/launch-motion/references/relay-motion-skill.md):
// half-second entrances with restrained overshoot, faster ease-in exits, eased camera, 3–4 frame staggers.
export { TL };
export const BEAT = 60 / TL.bpm;
export const STAGGER = 4; // frames between related children

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OVERSHOOT = Easing.bezier(0.34, 1.22, 0.64, 1);
const EXIT = Easing.bezier(0.55, 0, 1, 0.45);
export const CAMERA = Easing.bezier(0.45, 0, 0.2, 1);

const fr = (sec: number, fps: number) => Math.round(sec * fps);

/** 0 → 1 (slightly past 1, then settles) over ~0.5 s. `delay` is in frames, for staggers. */
export function enter(frame: number, fps: number, at: number, delay = 0, dur = 0.5) {
  const s = fr(at, fps) + delay;
  return interpolate(frame, [s, s + fr(dur, fps)], [0, 1], { ...clamp, easing: OVERSHOOT });
}

/** 0 → 1 over 60 % of an entrance, ease-in. */
export function exit(frame: number, fps: number, at: number, delay = 0, dur = 0.3) {
  const s = fr(at, fps) + delay;
  return interpolate(frame, [s, s + fr(dur, fps)], [0, 1], { ...clamp, easing: EXIT });
}

/** Eased camera move 0 → 1 between two times. */
export function move(frame: number, fps: number, from: number, to: number) {
  return interpolate(frame, [fr(from, fps), fr(to, fps)], [0, 1], { ...clamp, easing: CAMERA });
}

/** A punch-in on the beat: jumps by `amount` and eases back over half a bar. */
export function punch(frame: number, fps: number, at: number, amount = 0.06) {
  const s = fr(at, fps);
  if (frame < s) return 0;
  return amount * Math.exp(-(frame - s) / (fps * 0.35));
}
