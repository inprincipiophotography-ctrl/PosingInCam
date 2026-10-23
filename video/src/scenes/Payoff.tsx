import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Callout } from "../components/Callout";
import { Caption } from "../components/Caption";
import { PHOTO_SIZE, Shot } from "../components/Shot";
import { COPY, type CameraPhoto } from "../config";
import { useLayout } from "../layout";
import { C, ease, pop } from "../theme";

// Where things are on a pose card, as fractions of the card.
const SPOTS = {
  photo: { x: 0.64, y: 0.4 },
  notes: { x: 0.14, y: 0.42 },
  say: { x: 0.3, y: 0.86 },
};

type Beat = { spot?: keyof typeof SPOTS; label: string; at: number };

/** Payoff: push in from the camera to the card, then point at what is on it. */
export const Payoff: React.FC<{ photo: CameraPhoto; beats: Beat[]; pushAt?: number; bodiesAt?: number }> = ({ photo, beats, pushAt = 0.15, bodiesAt }) => {
  const frame = useCurrentFrame();
  const { u, fps, w, h, safe, tall, portrait } = useLayout();
  const fill = portrait ? 0.42 : tall ? 0.6 : 0.84; // share of the frame height the card fills
  // 9:16: lift the card above Instagram's bottom UI, under the caption.
  const cardCy = portrait ? safe.cy + 50 * u : h / 2;

  // The card's box on screen once the push has landed.
  const c = photo.card;
  const cover = Math.max(w / PHOTO_SIZE.w, h / PHOTO_SIZE.h);
  const zoom = Math.min((fill * h) / (c.h * PHOTO_SIZE.h * cover), (fill * w) / (c.w * PHOTO_SIZE.w * cover));
  const cw = c.w * PHOTO_SIZE.w * cover * zoom;
  const ch = c.h * PHOTO_SIZE.h * cover * zoom;
  const focusY = c.y + c.h / 2 + (h / 2 - cardCy) / (PHOTO_SIZE.h * cover * zoom);
  const views = [
    { t: 0, x: 0.5, y: 0.45, zoom: 1.05 },
    { t: pushAt, x: 0.5, y: 0.45, zoom: 1.05 },
    { t: pushAt + 0.9, y: focusY, card: fill },
    { t: 99, y: focusY, card: fill },
  ];
  const at = (s: keyof typeof SPOTS) => ({ x: w / 2 + (SPOTS[s].x - 0.5) * cw, y: cardCy + (SPOTS[s].y - 0.5) * ch });
  const landed = ease(frame, fps, pushAt + 0.6, pushAt + 1.0);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Shot src={photo.src} media={PHOTO_SIZE} photo={photo} views={views} />
      {tall ? (
        <>
          {/* One caption at a time above the card, with a ring on the part it names. */}
          {[...beats, ...(bodiesAt != null ? [{ label: `Works on ${COPY.bodies}`, at: bodiesAt }] : [])].map((b: Beat, i, all) => {
            const next = all[i + 1]?.at;
            const r = pop(frame, fps, b.at, 0.4);
            const gone = next != null && frame >= next * fps;
            const p = b.spot ? at(b.spot) : null;
            return gone || frame < b.at * fps ? null : (
              <React.Fragment key={i}>
                {p ? (
                  <div style={{ position: "absolute", left: p.x - 34 * u, top: p.y - 34 * u, width: 68 * u, height: 68 * u, borderRadius: "50%", border: `${5 * u}px solid ${C.accent}`, transform: `scale(${r})`, boxShadow: "0 0 0 6px rgba(255,255,255,0.7)" }} />
                ) : null}
                <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 10 * u, display: "flex", justifyContent: "center" }}>
                  <Caption text={b.label} at={b.at} size={44} />
                </div>
              </React.Fragment>
            );
          })}
        </>
      ) : (
        beats.map((b, i) => {
          const spot = b.spot ?? "photo";
          const from = at(spot);
          const right = spot === "photo";
          const to = { x: right ? w / 2 + cw / 2 + 110 * u : w / 2 - cw / 2 - 110 * u, y: from.y };
          return <Callout key={i} at={b.at} from={from} to={to} label={b.label} side={right ? "right" : "left"} />;
        })
      )}
      {bodiesAt != null && !tall ? (
        <div style={{ position: "absolute", left: w / 2 + cw / 2 + 110 * u, top: cardCy + ch * 0.3, opacity: landed }}>
          <Caption text={`Works on ${COPY.bodies}`} at={bodiesAt} size={34} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
