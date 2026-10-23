import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { CameraBack } from "../components/CameraBack";
import { Caption } from "../components/Caption";
import { Kinetic } from "../components/Kinetic";
import { CARDS } from "../config";
import { useLayout } from "../layout";
import { pop } from "../theme";

/** Timeline, family groups and shot list cards in a camera's playback, a press of ▶ between each. */
export const TextCards: React.FC<{ order?: (keyof typeof CARDS)[]; advanceAt: number[]; lines: { text: string; at: number }[]; caption?: { text: string; at: number } }> = ({
  order = ["groups", "timeline", "shotlist"], advanceAt, lines, caption,
}) => {
  const frame = useCurrentFrame();
  const { u, fps, w, h, safe, tall, portrait } = useLayout();
  const camW = tall ? w * 1.3 : w * 0.5;
  const camH = camW * 0.62;
  const p = pop(frame, fps, 0, 0.6);
  // Tall: a close-up with the screen (37 % across the body) centred; the grip runs off the right edge on purpose.
  const camX = tall ? w / 2 - camW * 0.37 : w * 0.66 - camW / 2;
  const camY = tall ? (portrait ? safe.cy + 120 * u : h / 2 + 90 * u) - camH / 2 : h / 2 - camH / 2;
  return (
    <AbsoluteFill>
      <Background />
      <div style={{ position: "absolute", left: camX, top: camY, transform: `translateY(${(1 - p) * 160 * u}px) rotate(${(1 - p) * -4}deg) scale(${1 + 0.02 * (frame / fps / 6)})` }}>
        <CameraBack width={camW} cards={order.map((k) => CARDS[k])} advanceAt={advanceAt} label="100-{n}/3" />
      </div>
      {caption ? (
        <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 10 * u, display: "flex", justifyContent: "center" }}>
          <Caption text={caption.text} at={caption.at} />
        </div>
      ) : (
        <div
          style={{
            position: "absolute", left: safe.left, top: tall ? safe.top : 0, width: tall ? safe.w : camX - safe.left - 40 * u, height: tall ? undefined : h,
            display: "flex", flexDirection: "column", justifyContent: "center", alignItems: tall ? "center" : "flex-start", gap: 6 * u,
          }}
        >
          {lines.map((l, i) => (
            <Kinetic key={i} text={l.text} at={l.at} size={tall ? 78 : 84} align={tall ? "center" : "left"} />
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};
