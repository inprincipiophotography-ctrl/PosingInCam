import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { SANS } from "../theme";
import { enter, exit } from "./motion";

/** Small caps label in the cards' own style ("SAY TO THE COUPLE"): a rule draws, then the words slide out of a mask. */
export const Label: React.FC<{ text: string; at: number; outAt?: number; color?: string; rule?: string; size?: number }> = ({
  text, at, outAt, color = "#fff", rule = "#e3403d", size = 26,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enter(frame, fps, at);
  const q = enter(frame, fps, at, 3);
  const o = outAt == null ? 0 : exit(frame, fps, outAt);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.7, opacity: 1 - o }}>
      <div style={{ width: size * 1.6, height: Math.max(2, size * 0.12), background: rule, transform: `scaleX(${Math.min(1, p)})`, transformOrigin: "left" }} />
      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            fontFamily: SANS, fontWeight: 600, fontSize: size, letterSpacing: "0.22em", color, whiteSpace: "nowrap",
            transform: `translateY(${(1 - q) * 110}%)`,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};
