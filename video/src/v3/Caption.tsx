import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { SANS } from "../theme";
import { enter, exit } from "../v2/motion";

export const RED = "#e3241b";

type Props = {
  lines: string[]; // `[word]` gets a highlight box
  at: number; // s
  outAt?: number;
  size: number;
  align?: "left" | "center";
  /** Per-word start times (s) for words that land on beats; otherwise words snap in 3 frames apart. */
  steps?: number[];
  highlight?: string; // box colour
  highlightInk?: string;
};

/** Reels-native caption: heavy Inter, a soft shadow for any background, words snap in; exits faster, upward. */
export const Caption: React.FC<Props> = ({ lines, at, outAt, size, align = "center", steps, highlight = RED, highlightInk = "#fff" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = outAt == null ? 0 : exit(frame, fps, outAt, 0, 0.2);
  let k = 0;
  return (
    <div
      style={{
        fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.1, letterSpacing: "-0.035em", color: "#fff", textAlign: align,
        textShadow: "0 4px 24px rgba(0,0,0,0.45)", opacity: 1 - o, transform: `translateY(${-o * 0.3 * size}px)`,
      }}
    >
      {lines.map((line, i) => (
        <div key={i}>
          {line.split(" ").map((raw, j, words) => {
            const hl = raw.startsWith("[") && raw.endsWith("]");
            const word = raw.replace(/[[\]]/g, "");
            const n = k++;
            const p = steps ? enter(frame, fps, steps[Math.min(n, steps.length - 1)], 0, 0.3) : enter(frame, fps, at, n * 3, 0.3);
            return (
              <span
                key={j}
                style={{
                  display: "inline-block", whiteSpace: "pre", opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * 0.25 * size}px) scale(${0.92 + 0.08 * p})`,
                  background: hl ? highlight : undefined, color: hl ? highlightInk : undefined, padding: hl ? "0 0.14em" : undefined,
                  borderRadius: hl ? 10 : undefined, textShadow: hl ? "none" : undefined,
                }}
              >
                {word}
                {j < words.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
