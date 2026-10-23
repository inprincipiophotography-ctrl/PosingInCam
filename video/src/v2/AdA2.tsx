import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LogoMark } from "../components/Logo";
import { SafeZoneGuide } from "../components/SafeZoneGuide";
import { FOOTAGE_SIZE, PHOTO_SIZE, Shot } from "../components/Shot";
import { Soundtrack } from "../components/Soundtrack";
import { COPY, FOOTAGE, MUSIC, PHOTOS, type CameraPhoto } from "../config";
import { useLayout } from "../layout";
import { SANS, SERIF } from "../theme";
import { Grade } from "./Grade";
import { Label } from "./Label";
import { MaskLines } from "./MaskLines";
import { STAGGER, TL, enter, exit, move, punch } from "./motion";
import { MAROON, Wipe } from "./Wipe";

// Ad A v2 "Blank", 9:16 for Instagram. Storyboard: storyboards/ad-a-v2.md; clock: timeline.json (shared with the music).
const ACCENT = "#ff4f45"; // the red star on the pose cards, lifted a touch so it reads over photos; #a40000 disappears on dark
const FULL = { w: 4538, h: 6051 }; // public/photos/full/DSC08435.jpg
const FIRST_LOOK_FULL: CameraPhoto = { ...PHOTOS.firstLook, src: "photos/full/DSC08435.jpg" };

/** View that puts a photo's card at screen height `cy`, `fill` of the frame tall. */
function cardView(p: CameraPhoto, media: { w: number; h: number }, W: number, H: number, fill: number, cy: number) {
  const cover = Math.max(W / media.w, H / media.h);
  const zoom = (fill * H) / (p.card.h * media.h * cover);
  return { x: p.card.x + p.card.w / 2, y: p.card.y + p.card.h / 2 + (H / 2 - cy) / (media.h * cover * zoom), zoom };
}

/** View that shows photo point (px, py) at screen height `sy`, `scale` screen px per photo px. */
function pointView(media: { w: number; h: number }, W: number, H: number, px: number, py: number, sy: number, scale: number) {
  const cover = Math.max(W / media.w, H / media.h);
  return { x: px, y: py + (H / 2 - sy) / (media.h * scale), zoom: scale / cover };
}

const sec = (frame: number, fps: number) => frame / fps;

// ---------- 1 · Hook: "The couple's waiting. / Your mind goes" ----------
const Hook: React.FC = () => {
  const { w, h, safe } = useLayout();
  const v = cardView(PHOTOS.editorial, PHOTO_SIZE, w, h, 0.9, h * 0.5);
  return (
    <AbsoluteFill style={{ background: "#0b0a0a" }}>
      {/* Out-of-focus close-up of the camera screen, slowly pushing in. */}
      <AbsoluteFill style={{ filter: "blur(16px) brightness(0.42) saturate(0.8)", transform: "scale(1.08)" }}>
        <Shot src={PHOTOS.editorial.src} media={PHOTO_SIZE} views={[{ t: 0, ...v }, { t: 4.2, ...v, zoom: v.zoom * 1.12 }]} />
      </AbsoluteFill>
      <Grade top={0.35} vignette={0.6} grain={0} />
      <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top, height: safe.h, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute" }}>
          <MaskLines lines={["The couple’s", "waiting."]} at={TL.hook.line1} outAt={TL.hook.line2 - 0.2} size={158} />
        </div>
        <div style={{ position: "absolute" }}>
          <MaskLines lines={["Your mind", "goes"]} at={TL.hook.line2} size={158} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- the white "blank" flash (3.5 s) and the punch through it into the drop (4.0 s) ----------
const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { safe, w } = useLayout();
  const t = sec(frame, fps);
  const on = interpolate(t, [TL.hook.flash, TL.hook.flash + 0.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const off = interpolate(t, [TL.drop, TL.drop + 0.17], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (on === 0 || off === 1) return null;
  const word = enter(frame, fps, TL.hook.flash, 0, 0.4);
  return (
    <AbsoluteFill style={{ background: "#fbfbfd", opacity: on * (1 - off) }}>
      <div
        style={{
          position: "absolute", left: 0, width: w, top: safe.cy, transform: `translateY(-50%) scale(${(0.94 + 0.06 * word) * (1 + off * 0.25)})`,
          textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 330, color: "#a40000", letterSpacing: "-0.02em", lineHeight: 1,
        }}
      >
        blank.
      </div>
    </AbsoluteFill>
  );
};

// ---------- 2 · Drop: the real camera, scrolling playback ----------
const Playback: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { safe } = useLayout();
  const seg = FOOTAGE.segments[0];
  const len = TL.playback.to - TL.playback.from;
  const z = 1 + punch(frame, fps, 0, 0.09) + punch(frame, fps, 2.0, 0.05);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Parent null: the punch-ins move the whole shot, the clip keeps its own slow push. */}
      <AbsoluteFill style={{ transform: `scale(${z})` }}>
        <Shot
          kind="video" src={FOOTAGE.src} media={FOOTAGE_SIZE} startFrom={seg.from} playbackRate={(seg.to - seg.from) / len}
          views={[{ t: 0, x: 0.5, y: 0.53, zoom: 1.12 }, { t: len, x: 0.5, y: 0.55, zoom: 1.24 }]}
        />
      </AbsoluteFill>
      <Grade top={0.78} vignette={0.4} grain={0} />
      <div style={{ position: "absolute", left: safe.left + 8, top: safe.top + 24, display: "flex", flexDirection: "column", gap: 28 }}>
        <Label text="SHOOT CARDS" at={TL.playback.text - TL.playback.from} outAt={2.05} />
        <MaskLines lines={["Your poses.", "*In playback.*"]} at={TL.playback.text - TL.playback.from + 0.1} outAt={2.05} size={142} align="left" accent={ACCENT} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- 3 · Stop motion: one held shot, only the card changes on each beat ----------
const STOP = [
  { photo: PHOTOS.editorial, media: PHOTO_SIZE, label: "THE POSE" },
  { photo: PHOTOS.vogue, media: PHOTO_SIZE, label: "CAMERA SETTINGS" },
  { photo: PHOTOS.fitCheck, media: PHOTO_SIZE, label: "A POSING HACK" },
];
const STOP_FILL = 0.34;
const STOP_CY = 0.5; // × frame height

const StopMotion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { w, h, safe } = useLayout();
  const t0 = TL.stopMotion.from;
  const cuts = TL.stopMotion.cuts.map((c) => c - t0);
  const t = sec(frame, fps);
  const i = Math.max(0, cuts.filter((c) => t >= c).length - 1);
  const shot = STOP[Math.min(i, STOP.length - 1)];
  // Parent null: one slow push across all the cuts, so they read as one shot.
  const z = 1 + 0.05 * move(frame, fps, 0, cuts[cuts.length - 1] + 0.5);
  return (
    <AbsoluteFill style={{ background: "#ecebe8" }}>
      <AbsoluteFill style={{ transform: `scale(${z})` }}>
        <Shot src={shot.photo.src} media={shot.media} views={[{ t: 0, ...cardView(shot.photo, shot.media, w, h, STOP_FILL, h * STOP_CY) }]} />
      </AbsoluteFill>
      <Grade top={0.72} vignette={0.35} grain={0} />
      <div style={{ position: "absolute", left: safe.left + 8, top: safe.top + 24, display: "flex", flexDirection: "column", gap: 54 }}>
        {/* Everything here has left by the cut to the payoff at the last beat. */}
        <MaskLines lines={["Right in your", "*camera.*"]} at={TL.stopMotion.text - t0} outAt={cuts[3] - 0.32} size={128} align="left" accent={ACCENT} />
        <div style={{ position: "relative", height: 40 }}>
          {STOP.map((s, k) => (
            <div key={s.label} style={{ position: "absolute", left: 0, top: 0 }}>
              <Label text={s.label} at={cuts[k] + 0.03} outAt={cuts[k + 1] - (k < STOP.length - 1 ? 0.12 : 0.32)} />
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- 4 · Payoff: from the camera into the words on the card ----------
const Payoff: React.FC = () => {
  const { w, h, safe } = useLayout();
  const start = cardView(FIRST_LOOK_FULL, FULL, w, h, STOP_FILL, h * STOP_CY);
  const c = FIRST_LOOK_FULL.card;
  // The "Say to the couple" box sits in the lower left of the card; frame it under the type.
  const say = pointView(FULL, w, h, c.x + c.w * 0.32, c.y + c.h * 0.86, h * 0.55, 1.3);
  const push = TL.payoff.push - TL.payoff.from;
  const lt = TL.payoff.label - TL.payoff.from;
  const out = TL.payoff.to - TL.payoff.from - 0.4;
  return (
    <AbsoluteFill style={{ background: "#ecebe8" }}>
      {/* Same framing as the stop motion for half a beat, then an eased push to the words. */}
      <AbsoluteFill style={{ transform: `scale(${1.05})` }}>
        <Shot src={FIRST_LOOK_FULL.src} media={FULL} views={[{ t: 0, ...start }, { t: push, ...start }, { t: push + 0.95, ...say }, { t: 4, ...say, zoom: say.zoom * 1.04 }]} />
      </AbsoluteFill>
      <Grade top={0.82} vignette={0.45} grain={0} />
      <div style={{ position: "absolute", left: safe.left + 8, top: safe.top + 24, display: "flex", flexDirection: "column", gap: 30 }}>
        {/* The card's own words stay readable below; the type names them instead of repeating them. */}
        <Label text="ON EVERY CARD" at={lt} outAt={out} />
        <MaskLines lines={["The exact words", "to say to *them.*"]} at={TL.payoff.quote - TL.payoff.from} outAt={out} size={124} align="left" accent={ACCENT} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- 5 · "No phone. No Pinterest." over the clip ----------
const NoPhone: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { safe } = useLayout();
  const seg = FOOTAGE.segments[1];
  const inP = move(frame, fps, 0, 0.3);
  return (
    <AbsoluteFill style={{ opacity: inP, transform: `scale(${1.1 - 0.1 * inP})` }}>
      <AbsoluteFill style={{ background: "#000" }}>
        <Shot kind="video" src={FOOTAGE.src} media={FOOTAGE_SIZE} startFrom={seg.from} views={[{ t: 0, x: 0.5, y: 0.56, zoom: 1.3 }, { t: 2, x: 0.5, y: 0.56, zoom: 1.38 }]} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(10,8,8,0.45)" }} />
      <Grade top={0.5} vignette={0.5} grain={0} />
      <div style={{ position: "absolute", left: safe.left, width: safe.w, top: safe.top, height: safe.h, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MaskLines lines={["No phone.", "No *Pinterest.*"]} at={TL.noPhone.text - TL.noPhone.from} size={150} accent={ACCENT} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- 6 · Logo + CTA on bordo ----------
const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { safe } = useLayout();
  const t0 = TL.end.from;
  const at = (s: number) => s - t0;
  const logo = enter(frame, fps, at(TL.end.logo), 0, 0.6);
  const build = interpolate(frame, [Math.round(at(TL.end.logo) * fps), Math.round((at(TL.end.logo) + 0.8) * fps)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const word = enter(frame, fps, at(TL.end.logo), STAGGER);
  const by = enter(frame, fps, at(TL.end.logo), STAGGER * 2);
  const btn = enter(frame, fps, at(TL.end.cta));
  const url = enter(frame, fps, at(TL.end.url));
  const note = enter(frame, fps, at(TL.end.url), STAGGER);
  // Click press on the beat: 1 → 0.96 → 1 over ~8 frames.
  const ps = Math.round(at(TL.end.press) * fps);
  const press = interpolate(frame, [ps, ps + 4, ps + 8], [1, 0.96, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Parent null: the whole lock-up drifts the entire time, so the hold is never frozen.
  const drift = move(frame, fps, 0, 3);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 38%, #9b0b0b 0%, ${MAROON} 48%, #4f0202 100%)` }}>
      <div
        style={{
          position: "absolute", left: safe.left, width: safe.w, top: safe.top, height: safe.h,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 56,
          transform: `translateY(${-10 * drift}px) scale(${1 + 0.02 * drift})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ transform: `scale(${0.7 + 0.3 * logo})`, opacity: Math.min(1, logo * 2) }}>
            <LogoMark size={104} build={build} inverse />
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 54, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1, opacity: Math.min(1, word * 1.5), transform: `translateX(${(1 - word) * -24}px)` }}>{COPY.brand}</div>
            <div style={{ fontFamily: SANS, fontSize: 26, color: "rgba(255,255,255,0.72)", marginTop: 8, opacity: Math.min(1, by * 1.5), transform: `translateX(${(1 - by) * -24}px)` }}>{COPY.byline}</div>
          </div>
        </div>
        <MaskLines lines={["Never go *blank*", "on a shoot again."]} at={at(TL.end.tagline)} size={118} accent="#ffc2bc" />
        <div
          style={{
            transform: `translateY(${(1 - btn) * 36}px) scale(${press})`, opacity: Math.min(1, btn * 1.6),
            background: "#fff", color: MAROON, fontFamily: SANS, fontWeight: 600, fontSize: 42, letterSpacing: "-0.01em",
            padding: "28px 56px", borderRadius: 999, boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
          }}
        >
          {COPY.cta} →
        </div>
        <div style={{ textAlign: "center", fontFamily: SANS, lineHeight: 1.45 }}>
          <div style={{ fontWeight: 600, fontSize: 34, color: "#fff", opacity: Math.min(1, url * 1.5), transform: `translateY(${(1 - url) * 16}px)` }}>{COPY.url}</div>
          <div style={{ fontSize: 26, color: "rgba(255,255,255,0.72)", opacity: Math.min(1, note * 1.5), transform: `translateY(${(1 - note) * 16}px)` }}>{COPY.ctaNote}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const AdA2: React.FC<{ guides?: boolean }> = ({ guides }) => {
  const { fps } = useVideoConfig();
  const seq = (from: number, to: number) => ({ from: Math.round(from * fps), durationInFrames: Math.round((to - from) * fps) });
  const [wipe1, wipe2] = TL.wipes;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Scenes overlap where a wipe, a flash or a cross-zoom covers the change. */}
      <Sequence {...seq(0, TL.drop + 0.2)} name="1 Hook">
        <Hook />
      </Sequence>
      <Sequence {...seq(TL.playback.from, wipe1 + 0.3)} name="2 Playback">
        <Playback />
      </Sequence>
      <Sequence {...seq(TL.stopMotion.from, TL.payoff.from)} name="3 Stop motion">
        <StopMotion />
      </Sequence>
      <Sequence {...seq(TL.payoff.from, TL.payoff.to)} name="4 Payoff">
        <Payoff />
      </Sequence>
      <Sequence {...seq(TL.noPhone.from, wipe2 + 0.3)} name="5 No phone">
        <NoPhone />
      </Sequence>
      <Sequence {...seq(TL.end.from, TL.seconds)} name="6 Logo + CTA">
        <End />
      </Sequence>
      <Wipe at={wipe1} />
      <Wipe at={wipe2} />
      <Flash />
      <Grade top={0} vignette={0} grain={0.08} />
      <Soundtrack src={MUSIC.adA2} volume={1} />
      {guides ? <SafeZoneGuide /> : null}
    </AbsoluteFill>
  );
};

export const AD_A2_SECONDS = TL.seconds;
