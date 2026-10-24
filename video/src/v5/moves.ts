import { CAMERA, EXIT, OVERSHOOT } from "../v2/motion";
import TL from "./timeline.json";

// Every movement in the ad, in seconds on the ad's clock. The picture animates from these and the sound
// design puts each whoosh's peak on the fastest frame of the same move, so the two can't drift apart.
export type Move = { from: number; dur: number; easing: (t: number) => number };

export const MOVES = {
  notifySlide: { from: TL.hook.notify, dur: 0.5, easing: OVERSHOOT },
  cardRise: { from: TL.card.rise[0], dur: TL.card.rise[1] - TL.card.rise[0], easing: CAMERA },
  callouts: TL.card.callouts.map((at) => ({ from: at, dur: 0.5, easing: OVERSHOOT })),
  calloutsOut: { from: TL.card.fan[0] - 0.25, dur: 0.25, easing: EXIT },
  fan: { from: TL.card.fan[0], dur: TL.card.fan[1] - TL.card.fan[0], easing: CAMERA },
  tagline: { from: TL.end.tagline, dur: 0.5, easing: OVERSHOOT },
} satisfies Record<string, Move | Move[]>;

// The fan: four pose-pack cards spread out behind the Editorial card, 3 frames apart.
export const FAN_STAGGER = 0.1;
export const fanLand = (k: number) => TL.card.fan[0] + 0.35 + k * FAN_STAGGER;
