import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { C, SERIF } from "../theme";
import { STAGGER, enter, exit } from "./motion";

type Props = {
  lines: string[]; // *word* = italic accent
  at: number;
  outAt?: number;
  size: number; // px
  color?: string;
  accent?: string;
  align?: "left" | "center";
  font?: string;
  weight?: number;
  lineHeight?: number;
  tracking?: string;
};

/** Each line rises out from behind its own mask, 4 frames after the one above; exits upward, faster. */
export const MaskLines: React.FC<Props> = ({
  lines, at, outAt, size, color = "#fff", accent = C.accent, align = "center", font = SERIF, weight = 400, lineHeight = 1.02, tracking = "-0.015em",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ fontFamily: font, fontWeight: weight, fontSize: size, lineHeight, letterSpacing: tracking, color, textAlign: align }}>
      {lines.map((line, i) => {
        const p = enter(frame, fps, at, i * STAGGER);
        const o = outAt == null ? 0 : exit(frame, fps, outAt, i * 2);
        const parts = line.split(/(\*[^*]+\*)/);
        return (
          // The mask: padding keeps descenders and italic overhangs inside it.
          <div key={i} style={{ overflow: "hidden", padding: `0 0.08em ${0.16 * size}px`, margin: `0 -0.08em ${-0.16 * size}px` }}>
            <div style={{ transform: `translateY(${(1 - p) * 105 - o * 105}%)`, whiteSpace: "pre" }}>
              {parts.map((s, j) =>
                s.startsWith("*") ? (
                  <span key={j} style={{ fontStyle: "italic", color: accent }}>{s.slice(1, -1)}</span>
                ) : (
                  <React.Fragment key={j}>{s}</React.Fragment>
                ),
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
