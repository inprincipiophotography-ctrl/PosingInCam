import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { Kinetic } from "../components/Kinetic";
import { useLayout } from "../layout";
import { C, SANS, SERIF, leave, pop } from "../theme";

const STEPS = ["Pick your poses", "Copy one folder to the SD card", "Press ▶ on the day"];

/** Fix, part 1: how it works in three steps. Chips come in 3–4 frames apart and overlap. */
export const Steps: React.FC<{ title: string; at: number; outAt: number }> = ({ title, at, outAt }) => {
  const frame = useCurrentFrame();
  const { u, fps, safe, tall } = useLayout();
  const out = leave(frame, fps, outAt, 0.3);
  return (
    <AbsoluteFill>
      <Background />
      <div style={{ position: "absolute", left: safe.left, top: safe.top, width: safe.w, height: safe.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 64 * u }}>
        <Kinetic text={title} at={at} outAt={outAt} size={tall ? 92 : 112} maxWidth={safe.w} />
        <div style={{ display: "flex", flexDirection: tall ? "column" : "row", gap: 24 * u, alignItems: "stretch", width: tall ? safe.w * 0.86 : undefined }}>
          {STEPS.map((s, i) => {
            const p = pop(frame, fps, at + 0.7 + i * 0.35);
            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 20 * u, background: C.surface, border: `${1.5 * u}px solid ${C.rule}`,
                  borderRadius: 24 * u, padding: `${24 * u}px ${34 * u}px ${24 * u}px ${26 * u}px`, boxShadow: `0 ${12 * u}px ${34 * u}px rgba(0,0,0,0.07)`,
                  opacity: Math.min(1, p * 1.5) * (1 - out), transform: `translateY(${(1 - p) * 40 * u - out * 20 * u}px)`,
                }}
              >
                <div style={{ fontFamily: SERIF, fontSize: 64 * u, color: C.accent, lineHeight: 1, width: 40 * u, textAlign: "center" }}>{i + 1}</div>
                <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: (tall ? 42 : 36) * u, color: C.ink, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{s}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
