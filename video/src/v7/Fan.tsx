import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { PHOTO_SIZE, Shot } from "../components/Shot";
import { PACK, PHOTOS } from "../config";
import { useLayout } from "../layout";
import { OVERSHOOT } from "../v2/motion";
import { BoxCaption } from "../v4/BoxCaption";
import { CARD, EDITORIAL, PoseCard } from "../v4/PoseCard";
import { clamp } from "./frame";
import TL from "./timeline.json";

// The fan, dealt: the Editorial card holds the middle, the four pack cards are dealt in behind it one by one
// (inner pair first, then the outer pair), each landing with a small overshoot; then the layers drift apart
// slowly, so the stack never sits still.

const S = 0.33; // card scale (422 × 634): between the caption and Instagram's bottom UI
const CY = 905;
const SLOT = [-2, -1, 1, 2]; // fan position of each PACK card, left to right
const DEAL = [2, 0, 1, 3]; // deal order of each PACK card: inner pair first, then the outer pair

export const Fan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { w, safe } = useLayout();
  const f = TL.fan;
  const len = f.to - f.from;
  const t = frame / fps;
  const settle = interpolate(t, [f.deal + 4 * f.stagger + f.land, len], [0, 1], clamp);
  const cw = CARD.w * S;
  const ch = CARD.h * S;
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <AbsoluteFill style={{ filter: "blur(22px) brightness(0.38)", transform: "scale(1.06)" }}>
        <Shot src={PHOTOS.editorial.src} media={PHOTO_SIZE} views={[{ t: 0, x: 0.5, y: 0.45, zoom: 1.1 }, { t: len, x: 0.5, y: 0.45, zoom: 1.14 }]} />
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${1 + 0.03 * (t / len)})`, transformOrigin: `50% ${CY}px` }}>
        {PACK.map((src, i) => {
          const slot = SLOT[i];
          const at = f.deal + DEAL[i] * f.stagger;
          const p = interpolate(t, [at, at + f.land], [0, 1], { ...clamp, easing: OVERSHOOT });
          const spread = 1 + 0.06 * settle; // parallax: the outer cards drift out a little further than the inner
          const x = slot * 96 * p * spread * (Math.abs(slot) === 2 ? 1.02 : 1);
          const y = Math.abs(slot) * 22 * p + (1 - p) * 1100;
          return (
            <div
              key={src}
              style={{
                position: "absolute", left: w / 2 - cw / 2 + x, top: CY - ch / 2 + y, width: cw, height: ch,
                transform: `rotate(${slot * 9 * p + (1 - p) * slot * 14}deg)`, transformOrigin: "50% 120%", zIndex: 3 - Math.abs(slot),
                borderRadius: 10, overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.6)", filter: `brightness(${0.7 + 0.25 * Math.min(1, p)})`,
              }}
            >
              <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
        <div style={{ position: "absolute", left: w / 2 - cw / 2, top: CY - ch / 2 - 6 * settle, width: cw, height: ch, zIndex: 5, boxShadow: "0 40px 90px rgba(0,0,0,0.7)" }}>
          <div style={{ transform: `scale(${S})`, transformOrigin: "0 0" }}>
            <PoseCard data={EDITORIAL} />
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 12 }}>
        <BoxCaption lines={["Every pose for", "[the whole day]"]} at={0.1} outAt={len - 0.2} size={80} />
      </div>
    </AbsoluteFill>
  );
};
