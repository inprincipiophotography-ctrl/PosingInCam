import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Footage } from "../components/Footage";
import { LogoMark } from "../components/Logo";
import { SafeZoneGuide } from "../components/SafeZoneGuide";
import { Shot } from "../components/Shot";
import { Soundtrack } from "../components/Soundtrack";
import { COPY, MUSIC, PACK, SHOOT } from "../config";
import { useLayout } from "../layout";
import { SANS } from "../theme";
import { Grade } from "../v2/Grade";
import { STAGGER, enter, exit, move, punch } from "../v2/motion";
import { CARD, EDITORIAL, PoseCard } from "../v4/PoseCard";
import { GlassCard, HOT, INK, RED, Stage } from "./Glass";
import { MOVES, fanLand } from "./moves";
import { SOUND } from "./sound";
import { SfxTrack } from "./Sfx";
import { Eyebrow, MixedLine } from "./Type";
import TL from "./timeline.json";

// Ad A v5 "Dark glass", 9:16. Storyboard: storyboards/ad-a-v5.md; sound: storyboards/ad-a-v5-sound.md.
// The on-screen inspiration in NotaLucis red: frosted glass UI floating over the real footage and on a dark
// stage, white Inter with one italic serif word in light red, a red glow from below.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const p01 = (frame: number, fps: number, from: number, dur: number, easing: (t: number) => number) =>
  interpolate(frame / fps, [from, from + dur], [0, 1], { ...clamp, easing });

/** Hard cut with a small punch-in that settles in half a beat. */
const Punch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <AbsoluteFill style={{ transform: `scale(${1 + punch(frame, fps, 0, 0.04)})` }}>{children}</AbsoluteFill>;
};

const At: React.FC<{ top: number; children: React.ReactNode }> = ({ top, children }) => {
  const { safe } = useLayout();
  return <div style={{ position: "absolute", left: safe.left, width: safe.w, top }}>{children}</div>;
};

/** The footage, graded into the dark look: a touch cooler, deeper, with the edges falling away. */
const Graded: React.FC<{ children: React.ReactNode; bottom?: number }> = ({ children, bottom = 0.55 }) => (
  <AbsoluteFill style={{ background: INK }}>
    <AbsoluteFill style={{ filter: "saturate(0.85) contrast(1.06) brightness(0.88)" }}>{children}</AbsoluteFill>
    <Grade top={0.45} bottom={bottom} vignette={0.6} grain={0} />
  </AbsoluteFill>
);

// ---------- 1 · Hook (0–3 s): POV over the wedding, a glass "next pose" notification drops in ----------
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { safe, w } = useLayout();
  const m = MOVES.notifySlide;
  const p = p01(frame, fps, m.from, m.dur, m.easing);
  const out = exit(frame, fps, TL.hook.to - 0.3, 0, 0.25);
  const cardW = 880;
  return (
    <AbsoluteFill>
      <Graded bottom={0.7}>
        <Shot kind="video" src={SHOOT.src} media={SHOOT.size} startFrom={0.2} views={[{ t: 0, x: 0.55, y: 0.52, zoom: 1.0 }, { t: 3, x: 0.53, y: 0.54, zoom: 1.1 }]} />
      </Graded>
      <div style={{ position: "absolute", left: (w - cardW) / 2, top: safe.top + 14, transform: `translateY(${(1 - p) * -300 - out * 260}px)`, opacity: Math.min(1, p * 3) * (1 - out) }}>
        <GlassCard width={cardW} height={196} radius={40} glow={0.8}>
          <div style={{ display: "flex", alignItems: "center", gap: 28, height: "100%", padding: "0 32px" }}>
            <div style={{ width: 98, height: 147, borderRadius: 10, overflow: "hidden", flex: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
              <div style={{ transform: `scale(${98 / CARD.w})`, transformOrigin: "0 0" }}>
                <PoseCard data={EDITORIAL} />
              </div>
            </div>
            <div style={{ fontFamily: SANS, color: "#fff" }}>
              <Eyebrow color={HOT}>NEXT POSE</Eyebrow>
              <div style={{ fontWeight: 600, fontSize: 44, letterSpacing: "-0.02em", marginTop: 6 }}>Editorial 1/1</div>
              <div style={{ fontSize: 27, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>“Stand in front of him, pop the leg…”</div>
            </div>
          </div>
        </GlassCard>
      </div>
      <At top={safe.bottom - 250}>
        <MixedLine lines={["POV: your camera tells you", "the *next pose.*"]} at={TL.hook.text} outAt={TL.hook.to - 0.3} size={58} />
      </At>
    </AbsoluteFill>
  );
};

// ---------- 2 · The couple (3–5 s): wide, the photographer's shoulder in the dark bottom ----------
const Couple: React.FC = () => {
  const { safe } = useLayout();
  const c = TL.couple;
  const len = c.to - c.from;
  return (
    <Punch>
      <Graded bottom={0.8}>
        <Shot kind="video" src={SHOOT.src} media={SHOOT.size} startFrom={c.source} playbackRate={c.rate} views={[{ t: 0, x: 0.5, y: 0.47, zoom: 1.12 }, { t: len, x: 0.5, y: 0.47, zoom: 1.18 }]} />
      </Graded>
      <At top={safe.bottom - 230}>
        <MixedLine lines={["Glance. Pose. *Shoot.*"]} at={c.text - c.from} outAt={len - 0.25} size={62} />
      </At>
    </Punch>
  );
};

// ---------- 3 · The card on the dark stage (5–11 s): it rises, three glass callouts read it, then the fan ----------
const S0 = 0.38; // card scale on the stage (486 × 730)
// Ordered top to bottom by where each points on the card, so the connector lines never cross.
const CALLOUTS = [
  { eyebrow: "THE POSE", body: ["Reference photo", "to copy"], anchor: { x: 1000, y: 700 }, h: 150 },
  { eyebrow: "THE HACK", body: ["His hand must be", "visible holding her."], anchor: { x: 260, y: 960 }, h: 168 },
  { eyebrow: "SAY TO THE COUPLE", body: ["“Stand in front of him,", "pop the leg, one arm", "relaxed by your side…”"], anchor: { x: 560, y: 1560 }, h: 228 },
];

const CardStage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { w, safe } = useLayout();
  const k = TL.card;
  const t = frame / fps + k.from; // ad seconds

  const rise = interpolate(t, [k.rise[0], k.rise[1]], [0, 1], { ...clamp, easing: MOVES.cardRise.easing });
  const fan = interpolate(t, [k.fan[0], k.fan[1]], [0, 1], { ...clamp, easing: MOVES.fan.easing });
  const float = Math.sin(t * 1.6) * 6;

  // Card: left of centre while the callouts read it, centred and smaller for the fan.
  const s = S0 + (0.3 - S0) * fan;
  const cx = 330 + (w / 2 - 330) * fan;
  const cy = 880 + (840 - 880) * fan;
  const cw = CARD.w * s;
  const ch = CARD.h * s;
  const left = cx - cw / 2;
  const top = cy - ch / 2 + (1 - rise) * 280 + float;
  const tiltX = (1 - rise) * 22 + 4 * (1 - fan);
  const tiltY = -6 * (1 - fan) + Math.sin(t * 0.9) * 2;

  const calloutsOut = interpolate(t, [MOVES.calloutsOut.from, MOVES.calloutsOut.from + MOVES.calloutsOut.dur], [0, 1], { ...clamp, easing: MOVES.calloutsOut.easing });
  const boxes = CALLOUTS.reduce<{ y: number; h: number }[]>((acc, c) => [...acc, { y: acc.length ? acc[acc.length - 1].y + acc[acc.length - 1].h + 30 : 560, h: c.h }], []);
  const boxX = 590;
  const boxW = w - boxX - safe.left + 10;

  return (
    <Punch>
      <AbsoluteFill>
        <Stage glowY={0.66} />
        {/* the fan: pose-pack cards spreading out behind the Editorial card */}
        {PACK.map((src, i) => {
          const land = interpolate(t, [fanLand(i) - 0.35, fanLand(i)], [0, 1], { ...clamp, easing: MOVES.fan.easing });
          const step = i % 2 === 0 ? 2 : 1; // outer, inner
          const order = [-2, -1, 1, 2][i];
          const rot = order * 11 * land;
          const dx = order * 112 * land;
          const dy = Math.abs(order) * 26 * land;
          return (
            <div
              key={src}
              style={{
                position: "absolute", left: w / 2 - cw / 2 + dx, top: cy - ch / 2 + dy + float * 0.6, width: cw, height: ch,
                transform: `rotate(${rot}deg)`, transformOrigin: "50% 120%", opacity: Math.min(1, land * 2),
                borderRadius: 12, overflow: "hidden", boxShadow: `0 30px 70px rgba(0,0,0,0.6), 0 0 50px rgba(227,36,27,${0.25 * land})`,
                zIndex: 2 - step, filter: `brightness(${0.75 + 0.25 * land})`,
              }}
            >
              <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
        {/* the Editorial card, with a red rim light under it */}
        <div style={{ position: "absolute", left: cx - cw * 0.55, top: top + ch * 0.75, width: cw * 1.1, height: ch * 0.5, background: `radial-gradient(ellipse at 50% 30%, rgba(227,36,27,${0.55 * rise}) 0%, rgba(125,3,3,0.2) 45%, rgba(0,0,0,0) 70%)`, filter: "blur(30px)" }} />
        <div
          style={{
            position: "absolute", left, top, width: cw, height: ch, opacity: Math.min(1, rise * 2.5), zIndex: 3,
            transform: `perspective(2200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
            boxShadow: `0 40px 90px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(255,255,255,0.18), 0 0 70px rgba(227,36,27,${0.35 * rise})`, borderRadius: 10, overflow: "hidden",
          }}
        >
          <div style={{ transform: `scale(${s})`, transformOrigin: "0 0" }}>
            <PoseCard data={EDITORIAL} />
          </div>
        </div>
        {/* connector lines from each callout to its part of the card */}
        <svg style={{ position: "absolute", left: 0, top: 0, zIndex: 4, overflow: "visible" }} width={w} height={1920}>
          {CALLOUTS.map((c, i) => {
            const at = MOVES.callouts[i].from;
            const draw = interpolate(t, [at + 0.2, at + 0.55], [0, 1], { ...clamp, easing: MOVES.cardRise.easing });
            const ax = left + c.anchor.x * s;
            const ay = top + c.anchor.y * s;
            const bx = boxX + 6;
            const by = boxes[i].y + boxes[i].h / 2;
            if (draw <= 0 || calloutsOut >= 1) return null;
            return (
              <g key={i} opacity={1 - calloutsOut}>
                <line x1={bx} y1={by} x2={bx + (ax - bx) * draw} y2={by + (ay - by) * draw} stroke={HOT} strokeWidth={2.5} strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px rgba(227,36,27,0.9))" }} />
                <circle cx={ax} cy={ay} r={9 * draw} fill={HOT} style={{ filter: "drop-shadow(0 0 8px rgba(227,36,27,1))" }} />
              </g>
            );
          })}
        </svg>
        {/* the glass callouts, sliding in from the right one at a time */}
        {CALLOUTS.map((c, i) => {
          const m = MOVES.callouts[i];
          const p = interpolate(t, [m.from, m.from + m.dur], [0, 1], { ...clamp, easing: m.easing });
          if (p <= 0) return null;
          return (
            <div key={i} style={{ position: "absolute", left: boxX, top: boxes[i].y, zIndex: 5, transform: `translateX(${(1 - p) * 520 + calloutsOut * 600}px)`, opacity: Math.min(1, p * 2) }}>
              <GlassCard width={boxW} height={boxes[i].h} radius={28} glow={0.7}>
                <div style={{ padding: "22px 26px", fontFamily: SANS, color: "#fff" }}>
                  <Eyebrow color={HOT}>{c.eyebrow}</Eyebrow>
                  <div style={{ marginTop: 8, fontSize: 29, lineHeight: 1.28, fontWeight: 500, letterSpacing: "-0.01em" }}>
                    {c.body.map((l) => <div key={l}>{l}</div>)}
                  </div>
                </div>
              </GlassCard>
            </div>
          );
        })}
        <At top={safe.top + 10}>
          <MixedLine lines={["Everything you need,", "on *one card.*"]} at={k.title - k.from} outAt={k.fan[0] - k.from - 0.3} size={58} />
        </At>
        <At top={safe.top + 10}>
          <MixedLine lines={["Every pose for", "*the whole day.*"]} at={k.fanText - k.from} outAt={k.to - k.from - 0.3} size={58} />
        </At>
      </AbsoluteFill>
    </Punch>
  );
};

// ---------- 4 · Playback (11–14 s): the real camera, glass chips for the bodies it works on ----------
const Playback: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { safe, w } = useLayout();
  const p = TL.playback;
  const chips = ["Sony", "Canon", "Nikon"];
  return (
    <Punch>
      <Graded bottom={0.6}>
        <Footage views={[{ t: 0, x: 0.5, y: 0.6, zoom: 1.12 }, { t: 3, x: 0.5, y: 0.6, zoom: 1.2 }]} />
      </Graded>
      <At top={safe.top + 10}>
        <MixedLine lines={["Right in your camera’s", "*playback.*"]} at={p.text - p.from} outAt={p.to - p.from - 0.3} size={58} />
      </At>
      <div style={{ position: "absolute", left: 0, width: w, top: safe.top + 200, display: "flex", justifyContent: "center", gap: 18 }}>
        {chips.map((c, i) => {
          const q = enter(frame, fps, p.chips - p.from + i * 0.1, 0, 0.4);
          const o = exit(frame, fps, p.to - p.from - 0.3);
          return (
            <div key={c} style={{ transform: `scale(${0.6 + 0.4 * q})`, opacity: Math.min(1, q * 2) * (1 - o) }}>
              <GlassCard width={200} height={76} radius={38} glow={0.6}>
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: SANS, fontWeight: 600, fontSize: 30, color: "#fff" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, background: HOT, boxShadow: `0 0 10px ${RED}` }} />
                  {c}
                </div>
              </GlassCard>
            </div>
          );
        })}
      </div>
    </Punch>
  );
};

// ---------- 5 · End (14–18.5 s): the orb, the glowing mark, the line, the offer, the arrow to Meta's button ----------
const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { safe, w } = useLayout();
  const e = TL.end;
  const at = (s: number) => s - e.from;
  const orb = interpolate(frame / fps, [0, 0.7], [0, 1], { ...clamp, easing: MOVES.cardRise.easing });
  const logo = enter(frame, fps, at(e.logo), 0, 0.55);
  const build = interpolate(frame / fps, [at(e.logo), at(e.logo) + 0.7], [0, 1], clamp);
  const word = enter(frame, fps, at(e.logo), STAGGER * 2);
  const offer = enter(frame, fps, at(e.offer));
  const sub = enter(frame, fps, at(e.offer), STAGGER);
  const tap = enter(frame, fps, at(e.tap));
  const beat = (frame / fps - at(e.tap)) / 0.5;
  const nudge = beat > 1 ? Math.sin((beat % 1) * Math.PI) * 14 : 0;
  const drift = move(frame, fps, 0, 4.5);
  const tileCy = 520;
  return (
    <Punch>
      <AbsoluteFill>
        <Stage orb={orb} glowY={0.36} />
        <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + 0.015 * drift})` }}>
          {/* the mark as a glowing glass tile on the orb */}
          <div style={{ position: "absolute", left: w / 2 - 80, top: tileCy - 80, transform: `scale(${0.6 + 0.4 * logo})`, opacity: Math.min(1, logo * 2) }}>
            <div style={{ width: 160, height: 160, borderRadius: 40, boxShadow: `0 0 0 1.5px rgba(255,255,255,0.5), 0 0 60px rgba(227,36,27,0.85), 0 0 140px rgba(227,36,27,0.45)`, overflow: "hidden" }}>
              <LogoMark size={160} build={build} inverse />
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, width: w, top: tileCy + 110, textAlign: "center", fontFamily: SANS, opacity: Math.min(1, word * 1.6), transform: `translateY(${(1 - word) * 16}px)` }}>
            <span style={{ fontWeight: 700, fontSize: 40, color: "#fff", letterSpacing: "-0.02em" }}>{COPY.brand}</span>
            <span style={{ fontSize: 26, color: "rgba(255,255,255,0.6)", marginLeft: 12 }}>{COPY.byline}</span>
          </div>
          <At top={tileCy + 190}>
            <MixedLine lines={["Never go *blank*", "on a shoot again."]} at={at(e.tagline)} size={70} />
          </At>
          <div style={{ position: "absolute", left: 0, width: w, top: 955, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ opacity: Math.min(1, offer * 1.6), transform: `translateY(${(1 - offer) * 24}px)` }}>
              <GlassCard width={600} height={88} radius={44} glow={1}>
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: 38, color: "#fff", letterSpacing: "-0.02em" }}>
                  Your first card is free
                </div>
              </GlassCard>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 27, color: "rgba(255,255,255,0.65)", opacity: Math.min(1, sub * 1.6) }}>No account · {COPY.bodies}</div>
          </div>
          {/* right above where Instagram draws the ad's button */}
          <div style={{ position: "absolute", left: 0, width: w, top: safe.bottom - 128, display: "flex", flexDirection: "column", alignItems: "center", opacity: Math.min(1, tap * 1.6), transform: `translateY(${(1 - tap) * 20}px)` }}>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 36, color: "#fff" }}>
              Tap <span style={{ color: HOT }}>{COPY.metaCta}</span> to make yours
            </div>
            <svg width={60} height={60} viewBox="0 0 56 56" style={{ transform: `translateY(${nudge}px)`, filter: `drop-shadow(0 0 8px ${RED})` }}>
              <path d="M14 20 L28 34 L42 20" fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </AbsoluteFill>
    </Punch>
  );
};

export const AdA5: React.FC<{ guides?: boolean }> = ({ guides }) => {
  const { fps } = useVideoConfig();
  const seq = (from: number, to: number) => ({ from: Math.round(from * fps), durationInFrames: Math.round((to - from) * fps) });
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Sequence {...seq(TL.hook.from, TL.hook.to)} name="1 Hook (POV)">
        <Hook />
      </Sequence>
      <Sequence {...seq(TL.couple.from, TL.couple.to)} name="2 The couple">
        <Couple />
      </Sequence>
      <Sequence {...seq(TL.card.from, TL.card.to)} name="3 The card">
        <CardStage />
      </Sequence>
      <Sequence {...seq(TL.playback.from, TL.playback.to)} name="4 Playback">
        <Playback />
      </Sequence>
      <Sequence {...seq(TL.end.from, TL.seconds)} name="5 End">
        <End />
      </Sequence>
      <Grade top={0} vignette={0} grain={0.06} />
      {/* Sound design: one family per track (see sound.ts), then the bed at −19 dB. */}
      <SfxTrack name="WHOOSHES" cues={SOUND.whooshes} masterDb={SOUND.masterDb} />
      <SfxTrack name="TEXTURES" cues={SOUND.textures} masterDb={SOUND.masterDb} />
      <SfxTrack name="RISERS" cues={SOUND.risers} masterDb={SOUND.masterDb} />
      <SfxTrack name="HITS" cues={SOUND.hits} masterDb={SOUND.masterDb} />
      <Sequence name="MUSIC (bed)" layout="none">
        <Soundtrack src={MUSIC.adA5} volume={Math.pow(10, (SOUND.bedDb + SOUND.masterDb) / 20)} />
      </Sequence>
      {guides ? <SafeZoneGuide /> : null}
    </AbsoluteFill>
  );
};

export const AD_A5_SECONDS = TL.seconds;
