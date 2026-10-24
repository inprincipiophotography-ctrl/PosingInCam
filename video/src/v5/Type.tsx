import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { SANS, SERIF } from "../theme";
import { enter, exit } from "../v2/motion";
import { HOT } from "./Glass";

/**
 * The text inspiration in the brand's colours: medium white Inter with one word set big in Instrument Serif
 * italic, light red, softly glowing. Write the accent as *word*. Each line rises out of a mask 4 frames after
 * the last; the block leaves faster, upwards.
 */
export const MixedLine: React.FC<{ lines: string[]; at: number; outAt?: number; size?: number; accentScale?: number; align?: "center" | "left" }> = ({
  lines, at, outAt, size = 64, accentScale = 1.55, align = "center",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = outAt == null ? 0 : exit(frame, fps, outAt, 0, 0.22);
  return (
    <div style={{ textAlign: align, opacity: 1 - o, transform: `translateY(${-o * 24}px)` }}>
      {lines.map((line, i) => {
        const p = enter(frame, fps, at, i * 4, 0.5);
        const parts = line.split(/(\*[^*]+\*)/);
        return (
          <div key={i} style={{ overflow: "hidden", padding: `0 0.1em ${size * 0.22}px`, margin: `0 -0.1em ${-size * 0.22}px` }}>
            <div
              style={{
                transform: `translateY(${(1 - p) * 110}%)`, fontFamily: SANS, fontWeight: 600, fontSize: size, lineHeight: 1.12,
                letterSpacing: "-0.03em", color: "#fff", whiteSpace: "pre", textShadow: "0 6px 30px rgba(0,0,0,0.5)",
              }}
            >
              {parts.map((s, j) =>
                s.startsWith("*") ? (
                  <span
                    key={j}
                    style={{
                      fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: size * accentScale, letterSpacing: "-0.01em",
                      color: HOT, textShadow: "0 0 28px rgba(227,36,27,0.55), 0 6px 30px rgba(0,0,0,0.5)", lineHeight: 0.9,
                    }}
                  >
                    {s.slice(1, -1)}
                  </span>
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

/** Small caps label for the glass cards (the cards' own "SAY TO THE COUPLE" voice). */
export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = "rgba(255,255,255,0.62)" }) => (
  <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 22, letterSpacing: "0.2em", color }}>{children}</div>
);
