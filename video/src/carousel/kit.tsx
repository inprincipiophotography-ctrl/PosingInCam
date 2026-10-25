import React from "react";
import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion";
import { LogoMark } from "../components/Logo";
import { COPY } from "../config";
import { SANS, SERIF } from "../theme";
import { CARD, EDITORIAL, PoseCard } from "../v4/PoseCard";
import { POSES } from "./data";

// The carousel's building blocks, in the NotaLucis editorial look: warm paper with a dot grid, black type, one red.
// Every slide is designed on a 1080 × 1440 canvas (3:4, the profile-grid size); the 4:5 ad version (1080 × 1350)
// scales that canvas to fit and lets the background run full-bleed, so both formats share one layout.
export const PAPER = "#f6f3ee";
export const INK = "#141416";
export const MUTED = "#6e6a64";
export const RED = "#a40000";
export const BORDO = "#7d0303";
export const W = 1080;
export const H = 1440;
export const M = 72; // side margin

const paper: React.CSSProperties = {
  background: `radial-gradient(circle, rgba(29,29,31,0.10) 1.4px, transparent 1.6px) 0 0 / 28px 28px, ${PAPER}`,
};

/** `*word*` turns italic red. */
const accent = (text: string, color = RED) =>
  text.split(/(\*[^*]+\*)/).map((s, i) => (s.startsWith("*") ? <span key={i} style={{ fontStyle: "italic", color }}>{s.slice(1, -1)}</span> : <React.Fragment key={i}>{s}</React.Fragment>));

export const Headline: React.FC<{ children: string; size?: number; color?: string; accentColor?: string; align?: "left" | "center"; style?: React.CSSProperties }> = ({
  children, size = 110, color = INK, accentColor = RED, align = "left", style,
}) => (
  <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: size, lineHeight: 1.0, letterSpacing: "-0.018em", color, whiteSpace: "pre-line", textAlign: align, ...style }}>
    {accent(children, accentColor)}
  </div>
);

export const Label: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = RED, style }) => (
  <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 22, letterSpacing: "0.18em", textTransform: "uppercase", color, ...style }}>{children}</div>
);

export const Body: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 34, color = "#3b3a38", style }) => (
  <div style={{ fontFamily: SANS, fontSize: size, lineHeight: 1.38, color, letterSpacing: "-0.005em", ...style }}>{children}</div>
);

/**
 * The slide: background full-bleed, content on the 1080 × 1440 canvas (scaled for 4:5), a small header with the
 * brand and the slide number, and a red rule across the foot that runs off the right edge into the next slide.
 */
export const Slide: React.FC<{ n: number; total: number; bg?: React.ReactNode; dark?: boolean; children: React.ReactNode }> = ({ n, total, bg, dark, children }) => {
  const { height, width } = useVideoConfig();
  const s = height / H;
  const ink = dark ? "#fff" : INK;
  const sub = dark ? "rgba(255,255,255,0.75)" : MUTED;
  const last = n === total;
  return (
    <AbsoluteFill style={paper}>
      {bg}
      <div style={{ position: "absolute", left: (width - W * s) / 2, top: 0, width: W, height: H, transform: `scale(${s})`, transformOrigin: "0 0" }}>
        {/* header */}
        <div style={{ position: "absolute", left: M, right: M, top: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <LogoMark size={40} inverse={dark} />
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", color: ink }}>{COPY.brand}</span>
          </div>
          <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 24, color: sub, fontVariantNumeric: "tabular-nums" }}>
            {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
        {children}
        {/* the rule that carries the eye to the next slide */}
        <div style={{ position: "absolute", left: n === 1 ? M : 0, right: last ? M : -40, top: H - 92, height: 4, background: dark ? "#fff" : RED }} />
        {last ? <div style={{ position: "absolute", right: M - 8, top: H - 98, width: 16, height: 16, borderRadius: 8, background: dark ? "#fff" : RED }} /> : null}
        <div style={{ position: "absolute", left: M, right: M, top: H - 72, display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: 24, color: sub }}>
          {/* no web address: the close sends people to comment POSE (DM) or the link in bio */}
          <span />
          {last ? <span /> : <span style={{ fontWeight: 600, color: ink }}>Swipe →</span>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** A pose card as it looks on the camera: an image of the real card, or the vector Editorial card. */
export const Card: React.FC<{ card: string; width: number; rotate?: number; style?: React.CSSProperties }> = ({ card, width, rotate = 0, style }) => {
  const h = (width * CARD.h) / CARD.w;
  return (
    <div style={{ width, height: h, borderRadius: 10, overflow: "hidden", boxShadow: "0 30px 60px rgba(40,20,10,0.22), 0 4px 12px rgba(40,20,10,0.12)", transform: `rotate(${rotate}deg)`, background: "#fff", ...style }}>
      {card === "editorial" ? (
        <div style={{ transform: `scale(${width / CARD.w})`, transformOrigin: "0 0" }}>
          <PoseCard data={EDITORIAL} />
        </div>
      ) : (
        <Img src={staticFile(card)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
    </div>
  );
};

/** All five cards, fanned out from the middle (Editorial in front). */
export const Fan: React.FC<{ cardWidth: number; spread?: number; style?: React.CSSProperties }> = ({ cardWidth, spread = 150, style }) => {
  const order = [0, 1, 3, 4]; // the pack cards, left to right; Editorial (2) goes in the middle, on top
  const slots = [-2, -1, 1, 2];
  const h = (cardWidth * CARD.h) / CARD.w;
  return (
    <div style={{ position: "relative", width: cardWidth, height: h, ...style }}>
      {order.map((p, i) => (
        <div key={p} style={{ position: "absolute", left: 0, top: Math.abs(slots[i]) * 26, transform: `translateX(${slots[i] * spread}px) rotate(${slots[i] * 8}deg)`, transformOrigin: "50% 110%", zIndex: 3 - Math.abs(slots[i]) }}>
          <Card card={POSES[p].card} width={cardWidth} />
        </div>
      ))}
      <div style={{ position: "absolute", left: 0, top: -14, zIndex: 5 }}>
        <Card card="editorial" width={cardWidth} />
      </div>
    </div>
  );
};

/** Three numbered steps: how a card gets into the camera. */
export const Steps: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const steps = [
    ["Pick your cards", "Poses, timelines, family groups and shot lists, or any image of your own."],
    ["Save them to your SD card", "They’re images, so the camera opens them like any photo."],
    ["Swipe in playback", "The next pose is one thumb-press away. No phone in sight."],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44, ...style }}>
      {steps.map(([t, d], i) => (
        <div key={t} style={{ display: "flex", gap: 34, alignItems: "flex-start" }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 120, lineHeight: 0.8, color: RED, width: 70, textAlign: "center", flex: "none" }}>{i + 1}</div>
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, letterSpacing: "-0.02em", color: INK }}>{t}</div>
            <Body size={30} style={{ marginTop: 8, color: MUTED }}>{d}</Body>
          </div>
        </div>
      ))}
    </div>
  );
};

/** Kim & Ivan, small and round, beside who they are. */
export const Founders: React.FC<{ dark?: boolean; style?: React.CSSProperties }> = ({ dark, style }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22, ...style }}>
    <div style={{ width: 96, height: 96, borderRadius: "50%", overflow: "hidden", flex: "none", boxShadow: `0 0 0 2px ${dark ? "rgba(255,255,255,0.85)" : "#fff"}, 0 8px 20px rgba(40,20,10,0.2)` }}>
      <Img src={staticFile("brand/kim-ivan.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
    <div style={{ fontFamily: SANS, fontSize: 28, lineHeight: 1.35, color: dark ? "rgba(255,255,255,0.8)" : MUTED }}>
      {COPY.madeBy.map((l, i) => <div key={l} style={i === 1 ? { color: dark ? "#fff" : INK, fontWeight: 600 } : undefined}>{l}</div>)}
    </div>
  </div>
);

/**
 * The close. Organic: what's free, comment POSE (DM) or the link in bio, and a reason to save the post.
 * Ad: what's free, and an arrow down to the "Learn more" button Meta draws under the ad.
 */
export const Cta: React.FC<{ variant?: "organic" | "ad" }> = ({ variant = "organic" }) => (variant === "ad" ? <CtaAd /> : (
  <>
    <div style={{ position: "absolute", left: M, right: M, top: 190 }}>
      <Label>Try it on your next wedding</Label>
      <Headline size={150} style={{ marginTop: 22 }}>{"Your first\ncard is *free.*"}</Headline>
      <Body size={34} style={{ marginTop: 28, maxWidth: 820 }}>No account. Make it, save it to your SD card, and see it in your camera’s playback tonight.</Body>
    </div>
    <div style={{ position: "absolute", left: M, right: M, top: 820, display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26, background: BORDO, color: "#fff", borderRadius: 26, padding: "34px 40px" }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 86, lineHeight: 0.9 }}>“</div>
        <div style={{ fontFamily: SANS, fontSize: 38, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
          Comment <b style={{ background: "#fff", color: BORDO, padding: "0 12px", borderRadius: 8 }}>POSE</b> and we’ll DM you the link
        </div>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 32, color: INK, textAlign: "center", marginTop: 6 }}>
        or tap the link in bio
      </div>
    </div>
    <div style={{ position: "absolute", left: M, right: M, top: 1150, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Founders />
      <div style={{ fontFamily: SANS, fontSize: 24, fontWeight: 600, color: RED, textAlign: "right", lineHeight: 1.3 }}>Save this<br />for your next<br />wedding ↗</div>
    </div>
  </>
));

const CtaAd: React.FC = () => (
  <>
    <div style={{ position: "absolute", left: M, right: M, top: 190 }}>
      <Label>Try it on your next wedding</Label>
      <Headline size={150} style={{ marginTop: 22 }}>{"Your first\ncard is *free.*"}</Headline>
      <Body size={34} style={{ marginTop: 28, maxWidth: 820 }}>No account. Make it, save it to your SD card, and see it in your camera’s playback tonight.</Body>
    </div>
    <Founders style={{ position: "absolute", left: M, top: 840 }} />
    {/* right above the button Meta draws under the ad */}
    <div style={{ position: "absolute", left: M, right: M, top: 1050, display: "flex", alignItems: "center", justifyContent: "space-between", background: BORDO, color: "#fff", borderRadius: 26, padding: "34px 40px" }}>
      <div style={{ fontFamily: SANS, fontSize: 40, letterSpacing: "-0.01em" }}>
        Tap <b style={{ background: "#fff", color: BORDO, padding: "0 12px", borderRadius: 8 }}>Learn more</b> below
      </div>
      <svg width={56} height={56} viewBox="0 0 56 56">
        <path d="M28 10 V44 M14 31 L28 45 L42 31" fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  </>
);

/** The Editorial card with its four parts called out on the right: what's on every card. */
export const CardAnatomy: React.FC<{ top: number }> = ({ top }) => {
  const cw = 470;
  const s = cw / CARD.w;
  const left = M;
  const parts = [
    { k: "The pose", v: "A real photo to copy", at: { x: 820, y: 700 }, y: 30 },
    { k: "Camera settings", v: "Vertical, eye level or lower", at: { x: 200, y: 700 }, y: 240 },
    { k: "The hack", v: "The detail that makes the shot", at: { x: 200, y: 1000 }, y: 450 },
    { k: "What to say", v: "The exact words for the couple", at: { x: 400, y: 1620 }, y: 660 },
  ];
  const bx = 600;
  return (
    <>
      <div style={{ position: "absolute", left, top, width: cw, height: CARD.h * s, borderRadius: 10, overflow: "hidden", boxShadow: "0 30px 60px rgba(40,20,10,0.22)" }}>
        <div style={{ transform: `scale(${s})`, transformOrigin: "0 0" }}>
          <PoseCard data={EDITORIAL} />
        </div>
      </div>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={W} height={H}>
        {parts.map((p) => (
          <g key={p.k}>
            <line x1={left + p.at.x * s} y1={top + p.at.y * s} x2={bx - 14} y2={top + p.y + 22} stroke={RED} strokeWidth={3} />
            <circle cx={left + p.at.x * s} cy={top + p.at.y * s} r={9} fill={RED} stroke="#fff" strokeWidth={3} />
          </g>
        ))}
      </svg>
      {parts.map((p) => (
        <div key={p.k} style={{ position: "absolute", left: bx, right: M, top: top + p.y }}>
          <Label>{p.k}</Label>
          <div style={{ fontFamily: SANS, fontSize: 30, lineHeight: 1.3, color: INK, marginTop: 8 }}>{p.v}</div>
        </div>
      ))}
    </>
  );
};

/** Three real cards on the real camera: what "swipe in playback" looks like. */
export const CameraStrip: React.FC<{ top: number }> = ({ top }) => (
  <div style={{ position: "absolute", left: M, right: M, top, display: "flex", gap: 18 }}>
    {["DSC08435", "DSC08439", "DSC08442"].map((f) => (
      <div key={f} style={{ flex: 1, height: 190, borderRadius: 16, overflow: "hidden", boxShadow: "0 16px 34px rgba(40,20,10,0.16)" }}>
        <Img src={staticFile(`photos/${f}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%", transform: "scale(1.5)" }} />
      </div>
    ))}
  </div>
);
