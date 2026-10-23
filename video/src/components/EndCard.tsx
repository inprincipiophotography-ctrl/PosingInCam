import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COPY } from "../config";
import { useLayout } from "../layout";
import { C, SANS, clamp, f, pop, press } from "../theme";
import { Background } from "./Background";
import { Kinetic } from "./Kinetic";
import { LogoMark } from "./Logo";

/**
 * Logo + tagline + CTA. Times are seconds from the start of this card.
 * Logo builds, the tagline follows a few frames later, the button lands and
 * gets one press; then everything keeps a slow drift to the last frame.
 */
export const EndCard: React.FC<{ tagline?: string; taglineTall?: string }> = ({
  tagline = "Never go *blank* on a shoot again.",
  taglineTall = "Never go *blank*\non a shoot again.",
}) => {
  const frame = useCurrentFrame();
  const { u, fps, safe, portrait, tall } = useLayout();
  const t = frame / fps;
  const logo = pop(frame, fps, 0.05, 0.6);
  const build = interpolate(frame, [f(0.1, fps), f(0.9, fps)], [0, 1], clamp);
  const word = pop(frame, fps, 0.25);
  const btn = pop(frame, fps, 1.0);
  const note = interpolate(frame, [f(1.3, fps), f(1.6, fps)], [0, 1], clamp);
  const drift = 1 + 0.012 * t;
  const headline = tall ? 96 : 124;

  return (
    <AbsoluteFill>
      <Background />
      <div
        style={{
          position: "absolute", left: safe.left, width: safe.w, top: safe.top, height: safe.h,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: (portrait ? 44 : 40) * u, transform: `scale(${drift})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 * u }}>
          <div style={{ transform: `scale(${logo})` }}>
            <LogoMark size={92 * u} build={build} />
          </div>
          <div style={{ opacity: word, transform: `translateX(${(1 - word) * -20 * u}px)` }}>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 50 * u, letterSpacing: "-0.02em", color: C.ink, lineHeight: 1 }}>{COPY.brand}</div>
            <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 24 * u, color: C.muted, marginTop: 6 * u }}>{COPY.byline}</div>
          </div>
        </div>
        <Kinetic text={tall ? taglineTall : tagline} at={0.4} size={headline} maxWidth={safe.w} stagger={0.06} />
        <div
          style={{
            transform: `translateY(${(1 - btn) * 30 * u}px) scale(${press(frame, fps, 1.75)})`, opacity: Math.min(1, btn * 1.4),
            background: C.accent, color: "#fff", fontFamily: SANS, fontWeight: 600, fontSize: 38 * u,
            padding: `${24 * u}px ${46 * u}px`, borderRadius: 999, boxShadow: `0 ${16 * u}px ${40 * u}px rgba(164,0,0,0.28)`,
          }}
        >
          {COPY.cta} →
        </div>
        <div style={{ opacity: note, textAlign: "center", fontFamily: SANS, color: C.ink2, fontSize: 30 * u, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 600, color: C.ink }}>{COPY.url}</div>
          <div style={{ color: C.muted, fontSize: 26 * u }}>{COPY.ctaNote}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
