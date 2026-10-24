import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Footage } from "../components/Footage";
import { LogoMark } from "../components/Logo";
import { SafeZoneGuide } from "../components/SafeZoneGuide";
import { PHOTO_SIZE, Shot } from "../components/Shot";
import { Soundtrack } from "../components/Soundtrack";
import { COPY, MUSIC, PHOTOS } from "../config";
import { useLayout } from "../layout";
import { SANS } from "../theme";
import { Grade } from "../v2/Grade";
import { CAMERA, STAGGER, enter, move } from "../v2/motion";
import { MAROON } from "../v2/Wipe";
import { BoxCaption, HOT } from "../v4/BoxCaption";
import { CARD, EDITORIAL, PoseCard, REGIONS } from "../v4/PoseCard";
import { Fan } from "./Fan";
import { HOOKS, Second, type HookId } from "./Hooks";
import { Punch, Top, clamp } from "./frame";
import TL from "./timeline.json";

// Ad A v7, 9:16 Reels, 15 s. Storyboard: storyboards/ad-a-v7.md.
// v4's look and rhythm, rebuilt around what sells: the pain first (or the POV), the camera as the answer by 3 s,
// the real playback by 5 s, one benefit on the card, the fan for range, and an end card that says who made it,
// how it gets into the camera and what's free. Three hooks (H1–H3) on one body for a Meta A/B test.

// ---------- 3 · Playback (5–8 s): the proof, a thumb swiping from card to card ----------
const Playback: React.FC = () => {
  const len = TL.playback.to - TL.playback.from;
  return (
    <Punch>
      <AbsoluteFill style={{ background: "#000" }}>
        {/* The camera screen sits at 0.56 of the clip's height; this puts it in the middle of the visible area. */}
        <Footage views={[{ t: 0, x: 0.5, y: 0.6, zoom: 1.12 }, { t: len, x: 0.5, y: 0.6, zoom: 1.2 }]} />
        <Grade top={0.3} vignette={0.3} grain={0} />
        <Top>
          <BoxCaption lines={["Swipe to the", "[next pose]"]} at={0.1} outAt={len - 0.2} size={84} />
        </Top>
      </AbsoluteFill>
    </Punch>
  );
};

// ---------- 4 · The card (8–10 s): one benefit, the words to say, sharp ----------
type Key = { t: number; s: number; fx: number; fy: number; sy: number };
function cameraAt(keys: Key[], t: number) {
  let i = 0;
  while (i < keys.length - 1 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const p = b.t === a.t ? 1 : CAMERA(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
  return { s: a.s * Math.pow(b.s / a.s, p), fx: a.fx + (b.fx - a.fx) * p, fy: a.fy + (b.fy - a.fy) * p, sy: a.sy + (b.sy - a.sy) * p };
}

const CardBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { w } = useLayout();
  const k = TL.card;
  const len = k.to - k.from;
  const t = frame / fps;
  const push = k.push - k.from;
  const cam = cameraAt(
    [
      { t: 0, s: 0.44, fx: CARD.w / 2, fy: CARD.h / 2, sy: 826 },
      { t: push, s: 0.44, fx: CARD.w / 2, fy: CARD.h / 2, sy: 826 },
      { t: push + 0.6, s: 1.18, fx: 392, fy: 1632, sy: 870 },
      { t: len, s: 1.22, fx: 392, fy: 1632, sy: 870 },
    ],
    t,
  );
  // The card dims except for "Say to the couple", which a red outline draws around.
  const r = REGIONS.say;
  const pad = 14;
  const dim = interpolate(t, [push, push + 0.5], [0, 1], { ...clamp, easing: CAMERA });
  const draw = interpolate(t, [push + 0.35, push + 0.8], [0, 1], { ...clamp, easing: CAMERA });
  const hole = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
  return (
    <Punch>
      <AbsoluteFill style={{ background: "#111" }}>
        <AbsoluteFill style={{ filter: "blur(22px) brightness(0.38)", transform: "scale(1.06)" }}>
          <Shot src={PHOTOS.editorial.src} media={PHOTO_SIZE} views={[{ t: 0, x: 0.5, y: 0.45, zoom: 1.1 }, { t: len, x: 0.5, y: 0.45, zoom: 1.14 }]} />
        </AbsoluteFill>
        <div style={{ position: "absolute", left: 0, top: 0, width: CARD.w, height: CARD.h, transformOrigin: "0 0", transform: `translate(${w / 2 - cam.fx * cam.s}px, ${cam.sy - cam.fy * cam.s}px) scale(${cam.s})` }}>
          <div style={{ width: CARD.w, height: CARD.h, boxShadow: "0 90px 160px rgba(0,0,0,0.6)" }}>
            <PoseCard data={EDITORIAL}>
              <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={CARD.w} height={CARD.h}>
                <path
                  d={`M0,0 H${CARD.w} V${CARD.h} H0 Z M${hole.x},${hole.y} h${hole.w} v${hole.h} h-${hole.w} z`}
                  fillRule="evenodd" fill="rgba(12,10,10,0.62)" opacity={dim}
                />
                <rect
                  x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={18} fill="none" stroke={HOT} strokeWidth={6 / cam.s}
                  pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw}
                />
              </svg>
            </PoseCard>
          </div>
        </div>
        {/* Darkens the top, so the part of the card under the caption stays quiet. */}
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,8,8,0.6) 0%, rgba(10,8,8,0.25) 16%, rgba(10,8,8,0) 26%)", opacity: dim }} />
        <Top>
          <BoxCaption lines={["The exact [words]", "to relax your couple"]} at={push + 0.3} outAt={len - 0.2} size={84} />
        </Top>
      </AbsoluteFill>
    </Punch>
  );
};

// ---------- 6 · End card (12–15 s): what's free, how it gets in, who made it; then Meta's button ----------
const EndLine: React.FC<{ lines: string[]; at: number }> = ({ lines, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 100, lineHeight: 1.1, letterSpacing: "-0.04em", color: "#fff" }}>
      {lines.map((line, i) => {
        const p = enter(frame, fps, at, i * STAGGER);
        return (
          <div key={i} style={{ opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * 30}px)` }}>
            {line.split(/(\[[^\]]+\])/).map((s, j) =>
              s.startsWith("[") ? (
                <span key={j} style={{ background: "#fff", color: MAROON, padding: "0 0.12em", borderRadius: 14 }}>{s.slice(1, -1)}</span>
              ) : (
                <React.Fragment key={j}>{s}</React.Fragment>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
};

const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { safe } = useLayout();
  const e = TL.end;
  const at = (s: number) => s - e.from;
  const rise = (s: number) => {
    const p = enter(frame, fps, at(s));
    return { opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * 20}px)` };
  };
  const logo = enter(frame, fps, at(e.logo), 0, 0.5);
  const build = interpolate(frame, [Math.round(at(e.logo) * fps), Math.round((at(e.logo) + 0.7) * fps)], [0, 1], clamp);
  const word = enter(frame, fps, at(e.logo), STAGGER);
  // The arrow nudges down on every beat, towards Meta's button below the safe area.
  const beat = ((frame / fps - at(e.tap)) / 0.5) % 1;
  const nudge = frame / fps > at(e.tap) + 0.5 ? Math.sin(Math.max(0, beat) * Math.PI) * 14 : 0;
  const drift = move(frame, fps, 0, 3);
  return (
    <Punch>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 34%, #9b0b0b 0%, ${MAROON} 50%, #4a0202 100%)` }}>
        <div
          style={{
            position: "absolute", left: safe.left, width: safe.w, top: safe.top + 30, height: safe.h - 30,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", transform: `scale(${1 + 0.015 * drift})`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ transform: `scale(${0.7 + 0.3 * logo})`, opacity: Math.min(1, logo * 2) }}>
              <LogoMark size={84} build={build} inverse />
            </div>
            <div style={{ opacity: Math.min(1, word * 1.5), transform: `translateX(${(1 - word) * -24}px)` }}>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1 }}>{COPY.brand}</div>
              <div style={{ fontFamily: SANS, fontSize: 24, color: "rgba(255,255,255,0.72)", marginTop: 6 }}>{COPY.byline}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
            <EndLine lines={["Your first card", "is [free]."]} at={at(e.offer)} />
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 36, color: "#fff", textAlign: "center", ...rise(e.how) }}>{COPY.how}</div>
            <div style={{ fontFamily: SANS, fontSize: 30, lineHeight: 1.35, color: "rgba(255,255,255,0.75)", textAlign: "center", ...rise(e.madeBy) }}>
              {COPY.madeBy.map((l) => <div key={l}>{l}</div>)}
            </div>
          </div>
          {/* The last thing in the safe area, right above where Instagram draws the ad's button. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, ...rise(e.tap) }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: "#fff", letterSpacing: "-0.015em" }}>
              Tap <span style={{ background: "#fff", color: MAROON, padding: "2px 14px", borderRadius: 10 }}>{COPY.metaCta}</span> to make yours
            </div>
            <svg width={72} height={72} viewBox="0 0 56 56" style={{ transform: `translateY(${nudge}px)` }}>
              <path d="M14 20 L28 34 L42 20" fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </AbsoluteFill>
    </Punch>
  );
};

export const AdA7: React.FC<{ hook: HookId; guides?: boolean }> = ({ hook, guides }) => {
  const { fps } = useVideoConfig();
  const seq = (from: number, to: number) => ({ from: Math.round(from * fps), durationInFrames: Math.round((to - from) * fps) });
  const Hook = HOOKS[hook];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence {...seq(TL.hook.from, TL.hook.to)} name={`1 Hook ${hook}`}>
        <Hook />
      </Sequence>
      <Sequence {...seq(TL.second.from, TL.second.to)} name={hook === "H3" ? "2 The couple" : "2 In your camera"}>
        <Second hook={hook} />
      </Sequence>
      <Sequence {...seq(TL.playback.from, TL.playback.to)} name="3 Playback">
        <Playback />
      </Sequence>
      <Sequence {...seq(TL.card.from, TL.card.to)} name="4 The card">
        <CardBeat />
      </Sequence>
      <Sequence {...seq(TL.fan.from, TL.fan.to)} name="5 The fan">
        <Punch>
          <Fan />
        </Punch>
      </Sequence>
      <Sequence {...seq(TL.end.from, TL.seconds)} name="6 End card">
        <End />
      </Sequence>
      <Grade top={0} vignette={0} grain={0.06} />
      <Soundtrack src={MUSIC.adA7} volume={1} />
      {guides ? <SafeZoneGuide /> : null}
    </AbsoluteFill>
  );
};

export const AD_A7_SECONDS = TL.seconds;
