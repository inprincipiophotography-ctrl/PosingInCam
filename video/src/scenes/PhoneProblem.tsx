import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { Kinetic } from "../components/Kinetic";
import { Phone } from "../components/Phone";
import { PHONE_GRID } from "../config";
import { useLayout } from "../layout";
import { leave, pop } from "../theme";

/** Problem: the phone comes out and the thumb hunts through a feed of poses, in front of the couple. */
export const PhoneProblem: React.FC<{ lines: { text: string; at: number }[]; phoneAt: number; outAt: number }> = ({ lines, phoneAt, outAt }) => {
  const frame = useCurrentFrame();
  const { u, fps, safe, tall, portrait, w, h } = useLayout();
  const p = pop(frame, fps, phoneAt, 0.6);
  const out = leave(frame, fps, outAt, 0.35);
  const phoneW = (portrait ? 330 : tall ? 300 : 380) * u;
  const phoneH = phoneW * (820 / 400);
  // Landscape: words left, phone right. Tall: words on top, phone under them.
  const phoneX = tall ? w / 2 - phoneW / 2 : w * 0.7 - phoneW / 2;
  // Tall: the phone sits under the words; in 9:16 its lower half may run into Instagram's UI (it's not text).
  const phoneY = tall ? safe.top + (portrait ? 470 : 420) * u : h / 2 - phoneH / 2;
  const tilt = (1 - p) * 8 - 3;
  return (
    <AbsoluteFill>
      <Background />
      <div
        style={{
          position: "absolute", left: phoneX, top: phoneY,
          transform: `translateY(${(1 - p) * h * 0.6 + out * h * 0.7}px) rotate(${tilt + out * 6}deg)`,
        }}
      >
        <Phone width={phoneW} images={PHONE_GRID} scrollFrom={phoneAt + 0.5} scrollTo={outAt} />
      </div>
      <div
        style={{
          position: "absolute", left: safe.left, top: tall ? safe.top : 0, width: tall ? safe.w : w * 0.5 - safe.left,
          height: tall ? undefined : h, display: "flex", flexDirection: "column", justifyContent: "center", gap: 34 * u,
          alignItems: tall ? "center" : "flex-start",
        }}
      >
        {lines.map((l, i) => (
          <Kinetic key={i} text={l.text} at={l.at} outAt={outAt} size={tall ? 76 : 96} align={tall ? "center" : "left"} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
