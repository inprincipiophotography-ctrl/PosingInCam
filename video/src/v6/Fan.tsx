import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { PHOTO_SIZE, Shot } from "../components/Shot";
import { PACK, PHOTOS } from "../config";
import { useLayout } from "../layout";
import { CAMERA } from "../v2/motion";
import { BoxCaption } from "../v4/BoxCaption";
import { CARD, EDITORIAL, PoseCard } from "../v4/PoseCard";
import TL from "./timeline.json";

// The fan (from Ad A v5), in v4's look: the Editorial card in the middle, four pack cards spreading out behind it
// 3 frames apart, over the same dark, out-of-focus camera the card scene ends on. v4's caption style and place.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const S = 0.33; // card scale (422 × 634): between the caption and Instagram's bottom UI
const CY = 905;
const STAGGER = 0.1;

export const Fan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { w, safe } = useLayout();
  const t = frame / fps;
  const [o0, o1] = TL.fan.open;
  const len = TL.fan.to - TL.fan.from;
  const drift = interpolate(t, [0, len], [1, 1.035], clamp);
  const cw = CARD.w * S;
  const ch = CARD.h * S;
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <AbsoluteFill style={{ filter: "blur(22px) brightness(0.38)", transform: "scale(1.06)" }}>
        <Shot src={PHOTOS.editorial.src} media={PHOTO_SIZE} views={[{ t: 0, x: 0.5, y: 0.45, zoom: 1.1 }, { t: len, x: 0.5, y: 0.45, zoom: 1.14 }]} />
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${drift})`, transformOrigin: `50% ${CY}px` }}>
        {PACK.map((src, i) => {
          const at = o0 + i * STAGGER;
          const p = interpolate(t, [at, at + (o1 - o0)], [0, 1], { ...clamp, easing: CAMERA });
          const order = [-2, -1, 1, 2][i];
          return (
            <div
              key={src}
              style={{
                position: "absolute", left: w / 2 - cw / 2 + order * 96 * p, top: CY - ch / 2 + Math.abs(order) * 22 * p, width: cw, height: ch,
                transform: `rotate(${order * 9 * p}deg)`, transformOrigin: "50% 120%", zIndex: 3 - Math.abs(order),
                borderRadius: 10, overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.6)", filter: `brightness(${0.7 + 0.25 * p})`,
              }}
            >
              <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
        <div style={{ position: "absolute", left: w / 2 - cw / 2, top: CY - ch / 2, width: cw, height: ch, zIndex: 5, boxShadow: "0 40px 90px rgba(0,0,0,0.7)" }}>
          <div style={{ transform: `scale(${S})`, transformOrigin: "0 0" }}>
            <PoseCard data={EDITORIAL} />
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 12 }}>
        <BoxCaption lines={["From the first look", "to the [first dance]"]} at={0.1} outAt={len - 0.2} size={80} />
      </div>
    </AbsoluteFill>
  );
};
