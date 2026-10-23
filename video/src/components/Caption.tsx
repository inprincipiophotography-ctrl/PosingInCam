import React from "react";
import { useCurrentFrame } from "remotion";
import { useLayout } from "../layout";
import { C, SANS, leave, pop } from "../theme";

/** White pill caption that sits over footage or photos (ads are watched with the sound off). */
export const Caption: React.FC<{ text: string; at: number; outAt?: number; size?: number; style?: React.CSSProperties }> = ({ text, at, outAt, size = 46, style }) => {
  const frame = useCurrentFrame();
  const { u, fps } = useLayout();
  const p = pop(frame, fps, at);
  const out = outAt == null ? 0 : leave(frame, fps, outAt);
  const parts = text.split(/(\*[^*]+\*)/);
  return (
    <div
      style={{
        display: "inline-block", background: "rgba(255,255,255,0.96)", color: C.ink, fontFamily: SANS, fontWeight: 600,
        fontSize: size * u, lineHeight: 1.2, letterSpacing: "-0.02em", padding: `${18 * u}px ${30 * u}px`, borderRadius: 22 * u,
        boxShadow: `0 ${14 * u}px ${40 * u}px rgba(0,0,0,0.18)`, textAlign: "center",
        opacity: Math.min(1, p * 1.5) * (1 - out), transform: `translateY(${(1 - p) * 26 * u - out * 14 * u}px) scale(${0.94 + 0.06 * p})`,
        ...style,
      }}
    >
      {parts.map((s, i) => (s.startsWith("*") ? <span key={i} style={{ color: C.accent }}>{s.slice(1, -1)}</span> : <React.Fragment key={i}>{s}</React.Fragment>))}
    </div>
  );
};
