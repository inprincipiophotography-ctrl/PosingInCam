import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Footage } from "../components/Footage";
import { LogoMark } from "../components/Logo";
import { SafeZoneGuide } from "../components/SafeZoneGuide";
import { PHOTO_SIZE, Shot, type View } from "../components/Shot";
import { Soundtrack } from "../components/Soundtrack";
import { COPY, MUSIC, PHOTOS, SHOOT, type CameraPhoto } from "../config";
import { useLayout } from "../layout";
import { SANS } from "../theme";
import { Grade } from "../v2/Grade";
import { STAGGER, enter, move, punch } from "../v2/motion";
import { MAROON } from "../v2/Wipe";
import { Caption, RED } from "./Caption";
import TL from "./timeline.json";

// Ad POV (Ad A v3), 9:16 Reels. Storyboard: storyboards/ad-pov.md. Reels-native: real footage in every frame,
// heavy captions with red highlights, a hard cut with a punch-in on every scene change, all on the beat.
const FULL = { w: 4538, h: 6051 };
const FIRST_LOOK_FULL: CameraPhoto = { ...PHOTOS.firstLook, src: "photos/full/DSC08435.jpg" };

/** Hard cut with a punch-in: the incoming shot lands 8 % big and settles within half a beat. */
const Punch: React.FC<{ children: React.ReactNode; amount?: number }> = ({ children, amount = 0.08 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <AbsoluteFill style={{ transform: `scale(${1 + punch(frame, fps, 0, amount)})` }}>{children}</AbsoluteFill>;
};

/** Caption block in the upper third, inside Instagram's safe area. */
const Top: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { safe } = useLayout();
  return <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top + 10 }}>{children}</div>;
};

// ---------- 1 · Hook (0–3 s): POV, the pose card on the camera in her hands ----------
const Hook: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Shot kind="video" src={SHOOT.src} media={SHOOT.size} startFrom={0.2} views={[{ t: 0, x: 0.55, y: 0.5, zoom: 1.0 }, { t: 3, x: 0.52, y: 0.52, zoom: 1.12 }]} />
    <Grade top={0.55} vignette={0.35} grain={0} />
    <Top>
      {/* Starts a beat early, so "POV:" is already there on the very first frame. */}
      <Caption lines={["POV: your camera", "tells you the", "[next] [pose.]"]} at={-0.2} outAt={2.82} size={104} />
    </Top>
  </AbsoluteFill>
);

// ---------- 2 · The couple (3–6 s): match cut from the card on the camera to the couple in the pose ----------
const Couple: React.FC = () => {
  const { safe } = useLayout();
  const c = TL.couple;
  // Only the sharp end of the take (from 5.55 s, after the focus pull), slowed down: shot at 50 fps, so 0.55× stays smooth.
  const views: View[] = [
    { t: 0, x: 0.51, y: 0.48, zoom: 1.02 },
    { t: 3, x: 0.48, y: 0.48, zoom: 1.12 },
  ];
  const t1 = c.text1 - c.from;
  const t2 = c.text2 - c.from;
  return (
    <Punch>
      <AbsoluteFill style={{ background: "#000" }}>
        <Shot kind="video" src={SHOOT.src} media={SHOOT.size} startFrom={c.source} playbackRate={c.rate} views={views} />
        <Grade top={0} bottom={0.55} vignette={0.35} grain={0} />
        {/* Low in the safe area, under the couple's faces. */}
        <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.bottom - 300 }}>
          <Caption lines={["Glance. Pose.", "[Shoot.]"]} at={t1} steps={[t1, t1 + 0.5, t1 + 0.9]} outAt={t2 - 0.18} size={112} />
        </div>
        <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.bottom - 300 }}>
          <Caption lines={["Your phone stays", "in your [pocket.]"]} at={t2} outAt={c.to - c.from - 0.2} size={96} />
        </div>
      </AbsoluteFill>
    </Punch>
  );
};

// ---------- 3 · Playback (6–8 s): the sharp 4K clip, a thumb scrolling from card to card ----------
const Playback: React.FC = () => {
  const p = TL.playback;
  return (
    <Punch>
      <AbsoluteFill style={{ background: "#000" }}>
        <Footage rate={1.2} views={[{ t: 0, x: 0.5, y: 0.58, zoom: 1.28 }, { t: 2.5, x: 0.5, y: 0.58, zoom: 1.4 }]} />
        <Grade top={0.6} vignette={0.35} grain={0} />
        <Top>
          <Caption lines={["Every pose, right in", "your camera’s", "[playback.]"]} at={p.text - p.from} outAt={p.to - p.from - 0.2} size={96} />
        </Top>
      </AbsoluteFill>
    </Punch>
  );
};

// ---------- 4 · The words (8–10 s): macro on the card's "Say to the couple" box, pulling back ----------
const Words: React.FC = () => {
  const { w, h } = useLayout();
  const p = TL.words;
  const c = FIRST_LOOK_FULL.card;
  const cover = Math.max(w / FULL.w, h / FULL.h);
  // Lift the box below the caption: the focus point sits under the frame centre.
  const box = (scale: number, sy: number) => ({ x: c.x + c.w * 0.3, y: c.y + c.h * 0.86 + (h / 2 - sy) / (FULL.h * scale), zoom: scale / cover });
  return (
    <Punch>
      <AbsoluteFill style={{ background: "#000" }}>
        <Shot src={FIRST_LOOK_FULL.src} media={FULL} views={[{ t: 0, ...box(1.9, h * 0.6) }, { t: 2, ...box(1.55, h * 0.6) }]} />
        <Grade top={0.7} vignette={0.4} grain={0} />
        <Top>
          <Caption lines={["+ the exact [words]", "to say to them."]} at={p.text - p.from} outAt={p.to - p.from - 0.2} size={100} />
        </Top>
      </AbsoluteFill>
    </Punch>
  );
};

// ---------- 5 · Stop motion (10–12 s): a card per beat, lined up on the same spot; the bodies it works on ----------
const STOP = [PHOTOS.editorial, PHOTOS.vogue, PHOTOS.fitCheck, PHOTOS.firstLook];

const StopMotion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { w, h } = useLayout();
  const cuts = TL.stopMotion.cuts.map((c) => c - TL.stopMotion.from);
  const t = frame / fps;
  const i = Math.max(0, cuts.filter((c) => t >= c).length - 1);
  const photo = STOP[Math.min(i, STOP.length - 1)];
  const fill = 0.4;
  const cy = h * 0.6;
  const cover = Math.max(w / PHOTO_SIZE.w, h / PHOTO_SIZE.h);
  const zoom = (fill * h) / (photo.card.h * PHOTO_SIZE.h * cover);
  const view = { x: photo.card.x + photo.card.w / 2, y: photo.card.y + photo.card.h / 2 + (h / 2 - cy) / (PHOTO_SIZE.h * cover * zoom), zoom };
  // Each cut gets a small punch; one slow push runs under all of them.
  const z = 1 + 0.04 * move(frame, fps, 0, 2) + punch(frame, fps, cuts[i], 0.04);
  const label = enter(frame, fps, 0, 0, 0.3);
  return (
    <AbsoluteFill style={{ background: "#ecebe8" }}>
      <AbsoluteFill style={{ transform: `scale(${z})` }}>
        <Shot src={photo.src} media={PHOTO_SIZE} photo={photo} views={[{ t: 0, ...view }]} />
      </AbsoluteFill>
      <Grade top={0.6} vignette={0.3} grain={0} />
      <Top>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-block", fontFamily: SANS, fontWeight: 800, fontSize: 36, letterSpacing: "0.08em", color: "#fff", background: RED,
              padding: "8px 18px", borderRadius: 8, opacity: Math.min(1, label * 2), transform: `translateY(${(1 - label) * 12}px)`,
            }}
          >
            WORKS ON
          </div>
          <div style={{ height: 16 }} />
          <Caption lines={["Sony. Canon. [Nikon.]"]} at={0.05} steps={[cuts[0] + 0.05, cuts[1] + 0.02, cuts[2] + 0.02]} size={100} />
        </div>
      </Top>
    </AbsoluteFill>
  );
};

// ---------- 6 · End card (12–16 s): bordo, logo, the line, the button ----------
const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { safe } = useLayout();
  const e = TL.end;
  const at = (s: number) => s - e.from;
  const logo = enter(frame, fps, at(e.logo), 0, 0.5);
  const build = interpolate(frame, [Math.round(at(e.logo) * fps), Math.round((at(e.logo) + 0.7) * fps)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const word = enter(frame, fps, at(e.logo), STAGGER);
  const btn = enter(frame, fps, at(e.cta));
  const url = enter(frame, fps, at(e.url));
  const note = enter(frame, fps, at(e.url), STAGGER);
  const ps = Math.round(at(e.press) * fps);
  const press = interpolate(frame, [ps, ps + 4, ps + 8], [1, 0.96, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const drift = move(frame, fps, 0, 4);
  return (
    <Punch amount={0.05}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 38%, #9b0b0b 0%, ${MAROON} 48%, #4f0202 100%)` }}>
        <div
          style={{
            position: "absolute", left: safe.left, width: safe.w, top: safe.top, height: safe.h,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 52,
            transform: `translateY(${-10 * drift}px) scale(${1 + 0.02 * drift})`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ transform: `scale(${0.7 + 0.3 * logo})`, opacity: Math.min(1, logo * 2) }}>
              <LogoMark size={96} build={build} inverse />
            </div>
            <div style={{ opacity: Math.min(1, word * 1.5), transform: `translateX(${(1 - word) * -24}px)` }}>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1 }}>{COPY.brand}</div>
              <div style={{ fontFamily: SANS, fontSize: 26, color: "rgba(255,255,255,0.72)", marginTop: 8 }}>{COPY.byline}</div>
            </div>
          </div>
          <Caption lines={["Never go [blank]", "on a shoot again."]} at={at(e.tagline)} size={98} highlight="#fff" highlightInk={MAROON} />
          <div
            style={{
              transform: `translateY(${(1 - btn) * 36}px) scale(${press})`, opacity: Math.min(1, btn * 1.6),
              background: "#fff", color: MAROON, fontFamily: SANS, fontWeight: 800, fontSize: 44, letterSpacing: "-0.02em",
              padding: "28px 56px", borderRadius: 999, boxShadow: "0 18px 50px rgba(0,0,0,0.3)",
            }}
          >
            {COPY.cta} →
          </div>
          <div style={{ textAlign: "center", fontFamily: SANS, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 700, fontSize: 36, color: "#fff", opacity: Math.min(1, url * 1.5), transform: `translateY(${(1 - url) * 16}px)` }}>{COPY.url}</div>
            <div style={{ fontSize: 28, color: "rgba(255,255,255,0.75)", opacity: Math.min(1, note * 1.5), transform: `translateY(${(1 - note) * 16}px)` }}>{COPY.ctaNote}</div>
          </div>
        </div>
      </AbsoluteFill>
    </Punch>
  );
};

export const AdPov: React.FC<{ guides?: boolean }> = ({ guides }) => {
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
      <Sequence {...seq(TL.playback.from, TL.playback.to)} name="3 Playback">
        <Playback />
      </Sequence>
      <Sequence {...seq(TL.words.from, TL.words.to)} name="4 The words">
        <Words />
      </Sequence>
      <Sequence {...seq(TL.stopMotion.from, TL.end.from)} name="5 Works on">
        <StopMotion />
      </Sequence>
      <Sequence {...seq(TL.end.from, TL.seconds)} name="6 Logo + CTA">
        <End />
      </Sequence>
      <Grade top={0} vignette={0} grain={0.07} />
      <Soundtrack src={MUSIC.adPov} volume={1} />
      {guides ? <SafeZoneGuide /> : null}
    </AbsoluteFill>
  );
};

export const AD_POV_SECONDS = TL.seconds;
