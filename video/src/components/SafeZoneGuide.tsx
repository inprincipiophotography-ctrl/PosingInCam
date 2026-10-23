import React from "react";
import { AbsoluteFill } from "remotion";
import { useLayout } from "../layout";

/** Review overlay (props.guides = true): the areas Instagram/Facebook cover with their own UI. Never in a final render. */
export const SafeZoneGuide: React.FC = () => {
  const { safe, w, h } = useLayout();
  const band: React.CSSProperties = { position: "absolute", left: 0, width: w, background: "rgba(0, 120, 255, 0.18)", borderColor: "rgba(0,120,255,0.8)", borderStyle: "dashed", borderWidth: 0 };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...band, top: 0, height: safe.top, borderBottomWidth: 3 }} />
      <div style={{ ...band, top: safe.bottom, height: h - safe.bottom, borderTopWidth: 3 }} />
      <div style={{ position: "absolute", left: safe.left, top: safe.top, width: safe.w, height: safe.h, outline: "3px dashed rgba(0,120,255,0.8)" }} />
    </AbsoluteFill>
  );
};
