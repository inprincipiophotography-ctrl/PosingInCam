import React from "react";
import { Audio, interpolate, staticFile, useVideoConfig } from "remotion";

/** The music bed: 0.3 s fade in, 1 s fade out on the last frames. Renders nothing until a track is set in config.ts. */
export const Soundtrack: React.FC<{ src: string | null; volume?: number }> = ({ src, volume = 0.8 }) => {
  const { fps, durationInFrames } = useVideoConfig();
  if (!src) return null;
  return (
    <Audio
      src={staticFile(src)}
      volume={(f) => volume * interpolate(f, [0, 0.3 * fps, durationInFrames - fps, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
  );
};
