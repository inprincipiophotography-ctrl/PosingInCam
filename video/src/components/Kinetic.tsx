import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { useLayout } from "../layout";
import { C, SANS, SERIF, clamp, f, leave, pop } from "../theme";

type Props = {
  /** Words appear one by one. Wrap a word in *stars* for the italic red accent. Use "\n" to break a line. */
  text: string;
  at: number; // seconds
  outAt?: number; // seconds; exits faster than it came in
  size: number; // px at 1080 (scaled by u)
  font?: "serif" | "sans";
  weight?: number;
  color?: string;
  align?: "left" | "center";
  stagger?: number; // seconds between words
  maxWidth?: number; // px, already scaled
  lineHeight?: number;
  tracking?: number; // em
  style?: React.CSSProperties;
};

/** Headline that builds word by word: each word rises in with a slight overshoot. */
export const Kinetic: React.FC<Props> = ({
  text, at, outAt, size, font = "serif", weight = 400, color = C.ink, align = "center",
  stagger = 0.07, maxWidth, lineHeight = 1.05, tracking, style,
}) => {
  const frame = useCurrentFrame();
  const { u, fps } = useLayout();
  const out = outAt == null ? 0 : leave(frame, fps, outAt, 0.3);
  let i = 0;
  const lines = text.split("\n");
  return (
    <div
      style={{
        fontFamily: font === "serif" ? SERIF : SANS,
        fontWeight: weight,
        fontSize: size * u,
        lineHeight,
        letterSpacing: tracking == null ? (font === "serif" ? "-0.01em" : "-0.02em") : `${tracking}em`,
        color,
        textAlign: align,
        maxWidth,
        opacity: 1 - out,
        transform: `translateY(${-out * 18 * u}px)`,
        ...style,
      }}
    >
      {lines.map((line, li) => (
        <div key={li}>
          {line.split(" ").map((raw, wi) => {
            const accent = /^\*.+\*[.,!?]*$/.test(raw);
            const word = raw.replace(/\*/g, "");
            const start = at + i++ * stagger;
            const p = pop(frame, fps, start, 0.5);
            const o = interpolate(frame, [f(start, fps), f(start + 0.18, fps)], [0, 1], clamp);
            return (
              <span
                key={wi}
                style={{
                  display: "inline-block",
                  whiteSpace: "pre",
                  opacity: o,
                  transform: `translateY(${(1 - p) * 0.45 * size * u}px)`,
                  fontStyle: accent && font === "serif" ? "italic" : undefined,
                  color: accent ? C.accent : undefined,
                }}
              >
                {word}
                {wi < line.split(" ").length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
