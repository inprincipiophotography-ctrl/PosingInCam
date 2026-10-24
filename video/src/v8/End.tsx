import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { LogoMark } from "../components/Logo";
import { COPY } from "../config";
import { useLayout } from "../layout";
import { SANS } from "../theme";
import { STAGGER, enter, move } from "../v2/motion";
import { MAROON } from "../v2/Wipe";
import { Punch, clamp } from "../v7/frame";
import TL from "./timeline.json";

// The end card of Ad A v7 (what's free, how it gets into the camera, who made it), on v6's clock,
// with Kim & Ivan in a small round photo beside "Made by wedding photographers".

// ---------- 6 · End card (12–15 s): what's free, how it gets in, who made it; then Meta's button ----------
const EndLine: React.FC<{ lines: string[]; at: number }> = ({ lines, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 100, lineHeight: 1.1, letterSpacing: "-0.04em", color: "#fff" }}>
      {lines.map((line, i) => {
        const p = enter(frame, fps, at, i * STAGGER);
        return (
          <div key={i} style={{ opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * 30}px)` }}>
            {line.split(/(\[[^\]]+\])/).map((s, j) =>
              s.startsWith("[") ? (
                <span key={j} style={{ background: "#fff", color: MAROON, padding: "0 0.12em", borderRadius: 14 }}>{s.slice(1, -1)}</span>
              ) : (
                <React.Fragment key={j}>{s}</React.Fragment>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
};

export const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { safe } = useLayout();
  const e = TL.end;
  const at = (s: number) => s - e.from;
  const rise = (s: number) => {
    const p = enter(frame, fps, at(s));
    return { opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 20}px)` };
  };
  const logo = enter(frame, fps, at(e.logo), 0, 0.5);
  const build = interpolate(frame, [Math.round(at(e.logo) * fps), Math.round((at(e.logo) + 0.7) * fps)], [0, 1], clamp);
  const word = enter(frame, fps, at(e.logo), STAGGER);
  // The arrow nudges down on every beat, towards Meta's button below the safe area.
  const beat = ((frame / fps - at(e.tap)) / 0.5) % 1;
  const nudge = frame / fps > at(e.tap) + 0.5 ? Math.sin(Math.max(0, beat) * Math.PI) * 14 : 0;
  const drift = move(frame, fps, 0, 3);
  return (
    <Punch>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 34%, #9b0b0b 0%, ${MAROON} 50%, #4a0202 100%)` }}>
        <div
          style={{
            position: "absolute", left: safe.left, width: safe.w, top: safe.top + 30, height: safe.h - 30,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", transform: `scale(${1 + 0.015 * drift})`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ transform: `scale(${0.7 + 0.3 * logo})`, opacity: Math.min(1, logo * 2) }}>
              <LogoMark size={84} build={build} inverse />
            </div>
            <div style={{ opacity: Math.min(1, word * 1.5), transform: `translateX(${(1 - word) * -24}px)` }}>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1 }}>{COPY.brand}</div>
              <div style={{ fontFamily: SANS, fontSize: 24, color: "rgba(255,255,255,0.72)", marginTop: 6 }}>{COPY.byline}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
            <EndLine lines={["Your first card", "is [free]."]} at={at(e.offer)} />
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 36, color: "#fff", textAlign: "center", ...rise(e.how) }}>{COPY.how}</div>
            {/* Who made it: the founders, small, in a round frame beside the line. */}
            <div style={{ display: "flex", alignItems: "center", gap: 18, ...rise(e.madeBy) }}>
              <div style={{ width: 84, height: 84, borderRadius: "50%", overflow: "hidden", flex: "none", boxShadow: "0 0 0 2px rgba(255,255,255,0.85), 0 8px 24px rgba(0,0,0,0.35)" }}>
                <Img src={staticFile("brand/kim-ivan.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ fontFamily: SANS, fontSize: 30, lineHeight: 1.35, color: "rgba(255,255,255,0.75)", textAlign: "left" }}>
                {COPY.madeBy.map((l) => <div key={l}>{l}</div>)}
              </div>
            </div>
          </div>
          {/* The last thing in the safe area, right above where Instagram draws the ad's button. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, ...rise(e.tap) }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: "#fff", letterSpacing: "-0.015em" }}>
              Tap <span style={{ background: "#fff", color: MAROON, padding: "2px 14px", borderRadius: 10 }}>{COPY.metaCta}</span> to make yours
            </div>
            <svg width={72} height={72} viewBox="0 0 56 56" style={{ transform: `translateY(${nudge}px)` }}>
              <path d="M14 20 L28 34 L42 20" fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </AbsoluteFill>
    </Punch>
  );
};
