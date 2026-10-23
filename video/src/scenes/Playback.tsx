import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { Caption } from "../components/Caption";
import { Footage } from "../components/Footage";
import { Kinetic } from "../components/Kinetic";
import { useLayout } from "../layout";
import { pop } from "../theme";

/**
 * Fix, part 2: the real camera, a thumb scrolling playback from card to card.
 * Tall formats: the clip full-bleed with a caption. 16:9: the clip as a tall panel, words beside it.
 */
export const Playback: React.FC<{ caption: string; line?: string; rate: number }> = ({ caption, line, rate }) => {
  const frame = useCurrentFrame();
  const { u, fps, safe, tall, w, h } = useLayout();
  // The camera screen sits a little below the clip's centre.
  const views = tall
    ? [{ t: 0, x: 0.5, y: 0.55, zoom: 1.15 }, { t: 6, x: 0.5, y: 0.55, zoom: 1.3 }]
    : [{ t: 0, x: 0.5, y: 0.6, zoom: 1.55 }, { t: 6, x: 0.5, y: 0.62, zoom: 1.75 }];
  if (tall) {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <Footage views={views} rate={rate} />
        <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 10 * u, display: "flex", justifyContent: "center" }}>
          <Caption text={caption} at={0.25} />
        </div>
      </AbsoluteFill>
    );
  }
  const pw = h * 0.86 * (9 / 16);
  const ph = h * 0.86;
  const p = pop(frame, fps, 0, 0.6);
  return (
    <AbsoluteFill>
      <Background />
      <div
        style={{
          position: "absolute", left: w * 0.68 - pw / 2, top: h / 2 - ph / 2, width: pw, height: ph, borderRadius: 36 * u, overflow: "hidden",
          boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,0.22)`, transform: `translateY(${(1 - p) * 120 * u}px) scale(${0.96 + 0.04 * p})`,
        }}
      >
        <Footage views={views} rate={rate} width={pw} height={ph} />
      </div>
      <div style={{ position: "absolute", left: safe.left, width: w * 0.68 - pw / 2 - safe.left - 60 * u, top: 0, height: h, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 * u }}>
        <Kinetic text={caption.replace(/\*/g, "")} at={0.3} size={84} align="left" />
        {line ? <Kinetic text={line} at={1.4} size={84} align="left" /> : null}
      </div>
    </AbsoluteFill>
  );
};
