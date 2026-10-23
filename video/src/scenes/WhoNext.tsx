import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { Kinetic } from "../components/Kinetic";
import { useLayout } from "../layout";
import { C, SANS, leave, pop } from "../theme";

const ASKS = [
  { t: "Grandma Rose?", x: -0.3, y: -0.32, r: -4 },
  { t: "His parents?", x: 0.28, y: -0.24, r: 3 },
  { t: "Her siblings?", x: -0.26, y: 0.26, r: 2 },
  { t: "Uncle Tom?", x: 0.3, y: 0.3, r: -3 },
  { t: "Both families?", x: 0.02, y: 0.4, r: 1 },
];

/** Hook for the family-groups ad: the questions pile up around "Who's next?". */
export const WhoNext: React.FC<{ at: number; outAt: number }> = ({ at, outAt }) => {
  const frame = useCurrentFrame();
  const { u, fps, safe } = useLayout();
  const out = leave(frame, fps, outAt, 0.3);
  return (
    <AbsoluteFill>
      <Background />
      {ASKS.map((a, i) => {
        const p = pop(frame, fps, at + 0.45 + i * 0.22);
        const wob = Math.sin((frame / fps) * 2 + i) * 3 * u;
        return (
          <div
            key={i}
            style={{
              position: "absolute", left: safe.cx + a.x * safe.w, top: safe.cy + a.y * safe.h + wob,
              transform: `translate(-50%, -50%) rotate(${a.r}deg) scale(${p * (1 - out * 0.3)})`, opacity: Math.min(1, p * 1.4) * (1 - out),
              background: C.surface, border: `${1.5 * u}px solid ${C.rule}`, borderRadius: 999, padding: `${16 * u}px ${28 * u}px`,
              fontFamily: SANS, fontWeight: 500, fontSize: 36 * u, color: C.ink2, whiteSpace: "nowrap", boxShadow: `0 ${10 * u}px ${30 * u}px rgba(0,0,0,0.08)`,
            }}
          >
            {a.t}
          </div>
        );
      })}
      <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.cy, transform: "translateY(-50%)" }}>
        <Kinetic text="Who’s *next?*" at={at} outAt={outAt} size={150} />
      </div>
    </AbsoluteFill>
  );
};
