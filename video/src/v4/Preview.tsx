import React from "react";
import { AbsoluteFill } from "remotion";
import { FIRST_LOOK, PoseCard } from "./PoseCard";

/** Check the vector card against the real one: the card at its native 1280 × 1920. */
export const CardPreview: React.FC = () => (
  <AbsoluteFill>
    <PoseCard data={FIRST_LOOK} />
  </AbsoluteFill>
);
