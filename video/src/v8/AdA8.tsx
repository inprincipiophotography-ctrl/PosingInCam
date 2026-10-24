import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Footage } from "../components/Footage";
import { SafeZoneGuide } from "../components/SafeZoneGuide";
import { PHOTO_SIZE, Shot } from "../components/Shot";
import { Soundtrack } from "../components/Soundtrack";
import { MUSIC, PHOTOS, SHOOT } from "../config";
import { useLayout } from "../layout";
import { Grade } from "../v2/Grade";
import { CAMERA, punch } from "../v2/motion";
import { BoxCaption, HOT } from "../v4/BoxCaption";
import { CARD, EDITORIAL, PoseCard, REGIONS, type Region } from "../v4/PoseCard";
import TL from "./timeline.json";
import { Fan } from "../v6/Fan";
import { End } from "./End";

// Ad A v8, 9:16 Reels: Ad A v6 exactly (v4 + the fan), with v7's end card and the founders in a small round photo.
// Storyboard: storyboards/ad-a-v8.md.
// Rhythm: a scene every 6 beats (3 s), cut on the beat with a small punch-in; one caption per idea, always in the
// same place and style; the card is vector UI, so every word on it is sharp; the end card points at Meta's own button.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Hard cut with a small punch-in that settles within half a beat. */
const Punch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <AbsoluteFill style={{ transform: `scale(${1 + punch(frame, fps, 0, 0.045)})` }}>{children}</AbsoluteFill>;
};

/** Captions always sit here: the top of Instagram's safe area. */
const Top: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { safe } = useLayout();
  return <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 12 }}>{children}</div>;
};

/** For a shot whose faces fill the top: the caption at the foot of the safe area instead. */
const Bottom: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { safe } = useLayout();
  return <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.bottom - 150 }}>{children}</div>;
};

// ---------- 1 · Hook (0–3 s): POV, the pose card on the camera in her hands ----------
const Hook: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Shot kind="video" src={SHOOT.src} media={SHOOT.size} startFrom={0.2} views={[{ t: 0, x: 0.55, y: 0.52, zoom: 1.0 }, { t: 3, x: 0.53, y: 0.54, zoom: 1.1 }]} />
    <Grade top={0.3} vignette={0.3} grain={0} />
    <Top>
      {/* A beat early, so the first frame already reads "POV: your camera". */}
      <BoxCaption lines={["POV: your camera", "tells you the", "[next pose.]"]} at={-0.45} outAt={2.8} size={92} />
    </Top>
  </AbsoluteFill>
);

// ---------- 2 · The couple (3–5 s): match cut to the couple in the pose, sharp, in slow motion ----------
const Couple: React.FC = () => {
  const c = TL.couple;
  const len = c.to - c.from;
  return (
    <Punch>
      <AbsoluteFill style={{ background: "#000" }}>
        {/* Shot at 50 fps, so 0.55× stays smooth; only the sharp end of the take (after the focus pull).
            A wide frame: the photographer's out-of-focus shoulder (lower left of the take) falls into the dark
            bottom, under Instagram's own UI; the faces fill the top, so the caption goes low. */}
        <Shot
          kind="video" src={SHOOT.src} media={SHOOT.size} startFrom={c.source} playbackRate={c.rate}
          views={[{ t: 0, x: 0.5, y: 0.47, zoom: 1.12 }, { t: len, x: 0.5, y: 0.47, zoom: 1.18 }]}
        />
        <Grade top={0.2} bottom={0.75} vignette={0.3} grain={0} />
        <Bottom>
          <BoxCaption lines={["Glance. Pose. [Shoot.]"]} at={0.1} outAt={len - 0.2} size={92} />
        </Bottom>
      </AbsoluteFill>
    </Punch>
  );
};

// ---------- 3 · The card (6–12 s): it lifts off the camera screen and we read it ----------
type Key = { t: number; s: number; fx: number; fy: number; sy: number };

/** Where the card is: scale `s` (screen px per card px), card point (fx, fy) at screen (540, sy). Eased between keys. */
function cameraAt(keys: Key[], t: number) {
  let i = 0;
  while (i < keys.length - 1 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const p = b.t === a.t ? 1 : CAMERA(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  return {
    s: a.s * Math.pow(b.s / a.s, p), // zoom in log space, so it feels even
    fx: a.fx + (b.fx - a.fx) * p,
    fy: a.fy + (b.fy - a.fy) * p,
    sy: a.sy + (b.sy - a.sy) * p,
  };
}

/** A red outline that draws itself around a region of the card (in card pixels, stroke kept ~6 px on screen). */
const Outline: React.FC<{ region: Region; from: number; to: number; s: number; t: number }> = ({ region, from, to, s, t }) => {
  const r = REGIONS[region];
  const draw = interpolate(t, [from, from + 0.45], [0, 1], { ...clamp, easing: CAMERA });
  const gone = interpolate(t, [to - 0.15, to], [0, 1], clamp);
  if (t < from || t > to) return null;
  const pad = 14;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={CARD.w} height={CARD.h}>
      <rect
        x={r.x - pad} y={r.y - pad} width={r.w + pad * 2} height={r.h + pad * 2} rx={18} fill="none" stroke={HOT} strokeWidth={6 / s}
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} opacity={1 - gone}
      />
    </svg>
  );
};

/**
 * Spotlight: the card dims except for the part being explained. The bright cut-out glides from part to part
 * with the camera, so the eye always knows where to look.
 */
const Spotlight: React.FC<{ t: number; stops: { at: number; region: Region }[]; until: number }> = ({ t, stops, until }) => {
  const on = interpolate(t, [stops[0].at, stops[0].at + 0.5], [0, 1], { ...clamp, easing: CAMERA });
  const off = interpolate(t, [until - 0.2, until], [0, 1], clamp);
  let i = 0;
  while (i < stops.length - 1 && t >= stops[i + 1].at) i++;
  const from = REGIONS[stops[Math.max(0, i - 1)].region];
  const to = REGIONS[stops[i].region];
  const p = i === 0 ? 1 : interpolate(t, [stops[i].at, stops[i].at + 0.6], [0, 1], { ...clamp, easing: CAMERA });
  const pad = 14;
  const r = {
    x: from.x + (to.x - from.x) * p - pad, y: from.y + (to.y - from.y) * p - pad,
    w: from.w + (to.w - from.w) * p + pad * 2, h: from.h + (to.h - from.h) * p + pad * 2,
  };
  const rr = 18;
  const hole = `M${r.x + rr},${r.y} h${r.w - 2 * rr} a${rr},${rr} 0 0 1 ${rr},${rr} v${r.h - 2 * rr} a${rr},${rr} 0 0 1 -${rr},${rr} h-${r.w - 2 * rr} a${rr},${rr} 0 0 1 -${rr},-${rr} v-${r.h - 2 * rr} a${rr},${rr} 0 0 1 ${rr},-${rr} z`;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0 }} width={CARD.w} height={CARD.h}>
      <path d={`M0,0 H${CARD.w} V${CARD.h} H0 Z ${hole}`} fillRule="evenodd" fill="rgba(12,10,10,0.62)" opacity={on * (1 - off)} />
    </svg>
  );
};

const CardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { w, h } = useLayout();
  const k = TL.card;
  const t = frame / fps;
  const rel = (x: number) => x - k.from;

  // The real photo of the same card that's on her camera in the hook, its screen in the middle of the visible area.
  const photo = PHOTOS.editorial;
  const fill = 0.36;
  const lcdCy = 840;
  const cover = Math.max(w / PHOTO_SIZE.w, h / PHOTO_SIZE.h);
  const zoom = (fill * h) / (photo.card.h * PHOTO_SIZE.h * cover);
  const view = { x: photo.card.x + photo.card.w / 2, y: photo.card.y + photo.card.h / 2 + (h / 2 - lcdCy) / (PHOTO_SIZE.h * cover * zoom), zoom };
  const lcdS = (photo.card.w * PHOTO_SIZE.w * cover * zoom) / CARD.w;

  const [l0, l1] = k.lift.map(rel);
  const keys: Key[] = [
    { t: 0, s: lcdS, fx: CARD.w / 2, fy: CARD.h / 2, sy: lcdCy },
    { t: l0, s: lcdS, fx: CARD.w / 2, fy: CARD.h / 2, sy: lcdCy },
    // Every framing keeps the card below the caption and above Instagram's bottom UI.
    { t: l1, s: 0.44, fx: CARD.w / 2, fy: CARD.h / 2, sy: 826 },
    { t: rel(k.pose), s: 0.44, fx: CARD.w / 2, fy: CARD.h / 2, sy: 826 },
    { t: rel(k.pose) + 0.6, s: 0.6, fx: 823, fy: 880, sy: 900 },
    { t: rel(k.say), s: 0.6, fx: 823, fy: 880, sy: 900 },
    { t: rel(k.say) + 0.6, s: 1.18, fx: 392, fy: 1632, sy: 870 },
    { t: rel(k.notes), s: 1.18, fx: 392, fy: 1632, sy: 870 },
    // Camera settings and the hack (card y 600–1230), with the card's title gone off the top of the frame.
    { t: rel(k.notes) + 0.6, s: 1.28, fx: 205, fy: 915, sy: 830 },
    { t: 6, s: 1.31, fx: 205, fy: 915, sy: 830 },
  ];
  const cam = cameraAt(keys, t);
  const tx = w / 2 - cam.fx * cam.s;
  const ty = cam.sy - cam.fy * cam.s;

  // Swap the photographed screen for the vector card, then lift it off: a tilt that settles, a growing shadow,
  // and the camera behind falls out of focus.
  const swap = interpolate(t, [rel(k.swap), rel(k.swap) + 0.15], [0, 1], clamp);
  const lift = interpolate(t, [l0, l1], [0, 1], { ...clamp, easing: CAMERA });
  const tilt = Math.sin(lift * Math.PI);
  const depth = interpolate(t, [l0, l1 + 0.2], [0, 1], clamp);

  return (
    <Punch>
      <AbsoluteFill style={{ background: "#111" }}>
        <AbsoluteFill style={{ filter: `blur(${depth * 22}px) brightness(${1 - depth * 0.62})`, transform: `scale(${1 + depth * 0.06})` }}>
          <Shot src={photo.src} media={PHOTO_SIZE} views={[{ t: 0, ...view }, { t: 6, ...view, zoom: view.zoom * 1.04 }]} />
        </AbsoluteFill>
        <div
          style={{
            position: "absolute", left: 0, top: 0, width: CARD.w, height: CARD.h, transformOrigin: "0 0",
            transform: `translate(${tx}px, ${ty}px) scale(${cam.s})`, opacity: swap,
          }}
        >
          <div
            style={{
              width: CARD.w, height: CARD.h, transformOrigin: "50% 50%",
              transform: `perspective(2600px) rotateX(${tilt * 9}deg) rotateY(${-tilt * 7}deg)`,
              boxShadow: `0 ${lift * 90}px ${lift * 160}px rgba(0,0,0,${0.15 + lift * 0.45})`,
            }}
          >
            <PoseCard data={EDITORIAL}>
              <Spotlight
                t={t} until={6}
                stops={[{ at: rel(k.pose), region: "photo" }, { at: rel(k.say), region: "say" }, { at: rel(k.notes), region: "notes" }]}
              />
              <Outline region="photo" from={rel(k.pose) + 0.35} to={rel(k.say)} s={cam.s} t={t} />
              <Outline region="say" from={rel(k.say) + 0.35} to={rel(k.notes)} s={cam.s} t={t} />
              <Outline region="notes" from={rel(k.notes) + 0.35} to={6} s={cam.s} t={t} />
            </PoseCard>
          </div>
        </div>
        {/* Darkens the top, so whatever part of the card passes under the caption stays quiet. */}
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,8,8,0.6) 0%, rgba(10,8,8,0.25) 16%, rgba(10,8,8,0) 26%)", opacity: depth }} />
        <Top>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 0, right: 0 }}>
              <BoxCaption lines={["On every card:"]} at={rel(k.lift[0]) + 0.1} outAt={rel(k.pose) - 0.2} size={84} />
            </div>
            <div style={{ position: "absolute", left: 0, right: 0 }}>
              <BoxCaption lines={["The [pose] to copy"]} at={rel(k.pose) + 0.1} outAt={rel(k.say) - 0.2} size={84} />
            </div>
            <div style={{ position: "absolute", left: 0, right: 0 }}>
              <BoxCaption lines={["The exact [words]", "to say to them"]} at={rel(k.say) + 0.1} outAt={rel(k.notes) - 0.2} size={84} />
            </div>
            <div style={{ position: "absolute", left: 0, right: 0 }}>
              <BoxCaption lines={["Settings + a [hack]"]} at={rel(k.notes) + 0.1} outAt={5.8} size={84} />
            </div>
          </div>
        </Top>
      </AbsoluteFill>
    </Punch>
  );
};

// ---------- 4 · Playback (12–15 s): the real thing, a thumb scrolling the cards, screen centred ----------
const Playback: React.FC = () => (
  <Punch>
    <AbsoluteFill style={{ background: "#000" }}>
      {/* The camera screen sits at 0.56 of the clip's height; this puts it in the middle of the visible area. */}
      <Footage views={[{ t: 0, x: 0.5, y: 0.6, zoom: 1.12 }, { t: 3, x: 0.5, y: 0.6, zoom: 1.2 }]} />
      <Grade top={0.3} vignette={0.3} grain={0} />
      <Top>
        <BoxCaption lines={["Every pose for the day,", "right in [playback]"]} at={0.1} outAt={2.8} size={80} />
      </Top>
    </AbsoluteFill>
  </Punch>
);

export const AdA8: React.FC<{ guides?: boolean }> = ({ guides }) => {
  const { fps } = useVideoConfig();
  const seq = (from: number, to: number) => ({ from: Math.round(from * fps), durationInFrames: Math.round((to - from) * fps) });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence {...seq(TL.hook.from, TL.hook.to)} name="1 Hook (POV)">
        <Hook />
      </Sequence>
      <Sequence {...seq(TL.couple.from, TL.couple.to)} name="2 The couple">
        <Couple />
      </Sequence>
      <Sequence {...seq(TL.card.from, TL.card.to)} name="3 The card">
        <CardScene />
      </Sequence>
      <Sequence {...seq(TL.fan.from, TL.fan.to)} name="4 The fan">
        <Punch>
          <Fan />
        </Punch>
      </Sequence>
      <Sequence {...seq(TL.playback.from, TL.playback.to)} name="5 Playback">
        <Playback />
      </Sequence>
      <Sequence {...seq(TL.end.from, TL.seconds)} name="6 End card">
        <End />
      </Sequence>
      <Grade top={0} vignette={0} grain={0.06} />
      <Soundtrack src={MUSIC.adA6} volume={1} /> {/* v6's music: same clock */}
      {guides ? <SafeZoneGuide /> : null}
    </AbsoluteFill>
  );
};

export const AD_A8_SECONDS = TL.seconds;
