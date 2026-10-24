import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// Dark glass, in NotaLucis red: frosted panels with a thin light edge and a red glow from below
// (the on-screen inspiration, with the brand's red where it has violet and blue).
export const RED = "#e3241b";
export const BORDO = "#7d0303";
export const HOT = "#ff6a5c"; // italic accent on dark
export const INK = "#07060a";

/** A frosted glass panel: blurred backdrop, gradient hairline edge, red glow at the bottom. */
export const GlassCard: React.FC<{ width: number; height?: number; radius?: number; glow?: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({
  width, height, radius = 34, glow = 1, children, style,
}) => (
  <div
    style={{
      position: "relative", width, height, borderRadius: radius, overflow: "hidden",
      background: "linear-gradient(160deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.05) 38%, rgba(255,255,255,0.03) 100%)",
      backdropFilter: "blur(26px) saturate(1.2)", WebkitBackdropFilter: "blur(26px) saturate(1.2)",
      boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 ${60 * glow}px rgba(227,36,27,${0.18 * glow}), inset 0 1px 0 rgba(255,255,255,0.22)`,
      ...style,
    }}
  >
    {/* the glow from below */}
    <div style={{ position: "absolute", left: "-10%", right: "-10%", bottom: "-45%", height: "80%", background: `radial-gradient(ellipse at 50% 40%, rgba(227,36,27,${0.55 * glow}) 0%, rgba(125,3,3,${0.25 * glow}) 40%, rgba(0,0,0,0) 70%)`, filter: "blur(10px)" }} />
    {/* the hairline edge: light top-left fading out */}
    <div
      style={{
        position: "absolute", inset: 0, borderRadius: radius, padding: 1.5, pointerEvents: "none",
        background: "linear-gradient(150deg, rgba(255,255,255,0.55), rgba(255,255,255,0.08) 45%, rgba(255,120,110,0.45))",
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude",
      }}
    />
    <div style={{ position: "relative", height: "100%" }}>{children}</div>
  </div>
);

/** The dark stage: near-black with a slow, breathing bordo glow. `orb` adds the glowing sphere of the end card. */
export const Stage: React.FC<{ orb?: number; glowY?: number }> = ({ orb = 0, glowY = 0.62 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const breathe = 1 + 0.06 * Math.sin((frame / fps) * 1.3);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 45% at 50% ${glowY * 100}%, rgba(125,3,3,0.55) 0%, rgba(60,2,2,0.25) 45%, rgba(7,6,10,0) 75%)`, transform: `scale(${breathe})` }} />
      {orb > 0 ? (
        <div
          style={{
            position: "absolute", left: width / 2 - 170, top: height * 0.36 - 170, width: 340, height: 340, borderRadius: "50%", opacity: orb,
            background: "radial-gradient(circle at 50% 38%, rgba(255,140,130,0.35) 0%, rgba(227,36,27,0.25) 30%, rgba(40,4,4,0.9) 66%)",
            boxShadow: `0 0 120px rgba(227,36,27,0.55), 0 0 260px rgba(227,36,27,0.25), inset 0 -20px 60px rgba(255,90,80,0.35), inset 0 10px 30px rgba(255,255,255,0.12)`,
            transform: `scale(${0.85 + 0.15 * orb * breathe})`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
