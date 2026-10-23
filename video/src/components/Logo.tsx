import React from "react";
import { interpolate } from "remotion";
import { clamp } from "../theme";

/** The Shoot Cards mark (favicon.svg). `build` 0 → 1 draws the frame, then the picture inside it. */
export const LogoMark: React.FC<{ size: number; build?: number }> = ({ size, build = 1 }) => {
  const frameDraw = interpolate(build, [0.2, 0.75], [1, 0], clamp);
  const inner = interpolate(build, [0.55, 1], [0, 1], clamp);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <defs>
        <linearGradient id="sc-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c01818" />
          <stop offset="1" stopColor="#7e0000" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#sc-g)" />
      <g fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="16" y="20" width="32" height="26" rx="5" pathLength={1} strokeDasharray={1} strokeDashoffset={frameDraw} />
        <path d="M18 42l8-7 6 5 6-6 6 5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - inner} />
      </g>
      <circle cx="26" cy="30" r={3.4 * inner} fill="#fff" />
    </svg>
  );
};
