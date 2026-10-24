import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayout } from "../layout";
import { punch } from "../v2/motion";

// v4's framing rules, shared by the v7 body and its hooks.
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Hard cut with a small punch-in that settles within half a beat. */
export const Punch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <AbsoluteFill style={{ transform: `scale(${1 + punch(frame, fps, 0, 0.045)})` }}>{children}</AbsoluteFill>;
};

/** Captions sit here: the top of Instagram's safe area. */
export const Top: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { safe } = useLayout();
  return <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 12 }}>{children}</div>;
};

/** For a shot whose faces fill the top: the caption at the foot of the safe area. */
export const Bottom: React.FC<{ children: React.ReactNode; lines?: number }> = ({ children, lines = 1 }) => {
  const { safe } = useLayout();
  return <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.bottom - 150 - (lines - 1) * 105 }}>{children}</div>;
};
