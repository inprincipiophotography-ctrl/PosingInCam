import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { Kinetic } from "../components/Kinetic";
import { useLayout } from "../layout";
import { C, SANS, f, pop } from "../theme";

/** Hook: big serif lines building word by word on the dot grid, slow push-in 100 → 106 %. */
export const Hook: React.FC<{ lines: { text: string; at: number }[]; outAt: number; dur: number; eyebrow?: string }> = ({ lines, outAt, dur, eyebrow }) => {
  const frame = useCurrentFrame();
  const { u, fps, safe, tall } = useLayout();
  const push = 1 + 0.06 * Math.min(1, frame / f(dur, fps));
  const eb = pop(frame, fps, 0);
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <div style={{ position: "absolute", left: safe.left, top: safe.top, width: safe.w, height: safe.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 * u }}>
          {eyebrow ? (
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26 * u, letterSpacing: "0.18em", color: C.accent, opacity: eb, marginBottom: 12 * u }}>{eyebrow}</div>
          ) : null}
          {lines.map((l, i) => (
            <Kinetic key={i} text={l.text} at={l.at} outAt={outAt} size={tall ? 118 : 132} maxWidth={safe.w} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
