import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * The finish over the picture: a dark gradient where the type sits (top), a soft vignette and
 * moving film grain. `top` is how dark the top gets (0–1).
 */
export const Grade: React.FC<{ top?: number; bottom?: number; vignette?: number; grain?: number }> = ({ top = 0.7, bottom = 0, vignette = 0.45, grain = 0.07 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {top > 0 ? (
        <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(10,8,8,${top}) 0%, rgba(10,8,8,${top * 0.75}) 22%, rgba(10,8,8,${top * 0.25}) 42%, rgba(10,8,8,0) 58%)` }} />
      ) : null}
      {bottom > 0 ? (
        <AbsoluteFill style={{ background: `linear-gradient(0deg, rgba(10,8,8,${bottom}) 0%, rgba(10,8,8,0) 40%)` }} />
      ) : null}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,${vignette}) 100%)` }} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: grain, mixBlendMode: "overlay" }}>
        <filter id={`grain-${frame % 4}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 24} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${frame % 4})`} />
      </svg>
    </AbsoluteFill>
  );
};
