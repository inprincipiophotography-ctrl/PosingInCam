import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useLayout } from "../layout";
import { C } from "../theme";

/** The NotaLucis soft dot grid. It drifts a little so the frame never fully stops. */
export const Background: React.FC<{ tone?: "light" | "dark" }> = ({ tone = "light" }) => {
  const frame = useCurrentFrame();
  const { u, fps } = useLayout();
  const step = 34 * u;
  const drift = (frame / fps) * 6 * u;
  const dark = tone === "dark";
  return (
    <AbsoluteFill
      style={{
        backgroundColor: dark ? C.body : C.bg,
        backgroundImage: `radial-gradient(${dark ? "rgba(255,255,255,0.07)" : C.dot} ${1.6 * u}px, transparent ${1.9 * u}px)`,
        backgroundSize: `${step}px ${step}px`,
        backgroundPosition: `${drift}px ${drift * 0.5}px`,
      }}
    />
  );
};
