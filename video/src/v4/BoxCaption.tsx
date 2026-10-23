import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { SANS } from "../theme";
import { enter, exit } from "../v2/motion";

export const HOT = "#ff4f45";

/**
 * The one caption style for the whole ad: heavy white Inter on a near-black box per line,
 * readable over a white card or bright footage alike. `[word]` turns red.
 * Lines rise in 4 frames apart; the caption leaves faster than it came.
 */
export const BoxCaption: React.FC<{ lines: string[]; at: number; outAt?: number; size?: number }> = ({ lines, at, outAt, size = 84 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = outAt == null ? 0 : exit(frame, fps, outAt, 0, 0.2);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.12, opacity: 1 - o, transform: `translateY(${-o * 20}px)` }}>
      {lines.map((line, i) => {
        const p = enter(frame, fps, at, i * 4, 0.4);
        return (
          <div
            key={i}
            style={{
              fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.12, letterSpacing: "-0.03em", color: "#fff", whiteSpace: "nowrap",
              background: "rgba(14,12,12,0.86)", padding: `${size * 0.08}px ${size * 0.26}px ${size * 0.12}px`, borderRadius: size * 0.2,
              opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * 26}px) scale(${0.96 + 0.04 * p})`,
            }}
          >
            {line.split(/(\[[^\]]+\])/).map((s, j) => (s.startsWith("[") ? <span key={j} style={{ color: HOT }}>{s.slice(1, -1)}</span> : <React.Fragment key={j}>{s}</React.Fragment>))}
          </div>
        );
      })}
    </div>
  );
};
