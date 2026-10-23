import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { PHOTO_SIZE, Shot } from "../components/Shot";
import type { CameraPhoto } from "../config";
import { useLayout } from "../layout";
import { C } from "../theme";

/**
 * Playback, as stop motion: the real photos cut one after another with every
 * card lined up on the same spot, so the camera holds still and only the card changes.
 */
export const StopMotion: React.FC<{ photos: CameraPhoto[]; hold: number; caption: string; captionAt?: number }> = ({ photos, hold, caption, captionAt = 0.2 }) => {
  const { fps } = useVideoConfig();
  const { u, w, h, safe, portrait, tall } = useLayout();
  const fill = portrait ? 0.36 : tall ? 0.48 : 0.62;
  const cardCy = portrait ? safe.cy + 60 * u : tall ? h / 2 + 40 * u : h / 2;
  const cover = Math.max(w / PHOTO_SIZE.w, h / PHOTO_SIZE.h);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {photos.map((p, i) => {
        const c = p.card;
        const zoom = Math.min((fill * h) / (c.h * PHOTO_SIZE.h * cover), (fill * w) / (c.w * PHOTO_SIZE.w * cover));
        const y = c.y + c.h / 2 + (h / 2 - cardCy) / (PHOTO_SIZE.h * cover * zoom);
        const last = i === photos.length - 1;
        return (
          <Sequence key={i} from={Math.round(i * hold * fps)} durationInFrames={last ? undefined : Math.round(hold * fps)}>
            {/* Each cut continues the same slow push, so the cuts read as one held shot. */}
            <Shot src={p.src} media={PHOTO_SIZE} photo={p} views={[{ t: -i * hold, y, card: fill }, { t: photos.length * hold + 2, y, card: fill * 1.05 }]} />
          </Sequence>
        );
      })}
      <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 10 * u, display: "flex", justifyContent: "center" }}>
        <Caption text={caption} at={captionAt} />
      </div>
    </AbsoluteFill>
  );
};
