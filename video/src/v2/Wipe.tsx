import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CAMERA } from "./motion";

export const MAROON = "#7d0303";

/**
 * Two bordo panels (the strip on every pose card) sweep up across the frame.
 * The frame is fully covered at `at + dur / 2`: cut the scenes underneath there.
 */
export const Wipe: React.FC<{ at: number; dur?: number; stay?: boolean }> = ({ at, dur = 0.5, stay = false }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const s = Math.round(at * fps);
  const e = s + Math.round(dur * fps);
  const mid = (s + e) / 2;
  // Lead panel (brighter red) runs 3 frames ahead of the bordo one.
  const panel = (delay: number, color: string) => {
    const enterP = interpolate(frame, [s + delay, mid + delay], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: CAMERA });
    const exitP = stay ? 0 : interpolate(frame, [mid + delay, e + delay], [0, -1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: CAMERA });
    const y = frame < mid + delay ? enterP : exitP;
    if (frame < s + delay || (!stay && frame > e + delay)) return null;
    return <AbsoluteFill style={{ background: color, transform: `translateY(${y * height}px)` }} />;
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {panel(0, "#a40000")}
      {panel(3, MAROON)}
    </AbsoluteFill>
  );
};
