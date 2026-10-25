import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { SANS } from "../theme";
import { CARD, EDITORIAL, PoseCard } from "../v4/PoseCard";
import { Body, Cta, Fan, Founders, Headline, INK, Label, M, MUTED, RED, Slide, Steps, W } from "./kit";

// Concept B, direct sale: the moment every photographer knows, the phone, the answer in the camera, what's on a
// card, how it gets there, the range, the free card. 7 slides.
const N = 7;

const Hook: React.FC = () => (
  <Slide
    n={1} total={N} dark
    bg={
      <AbsoluteFill>
        <Img src={staticFile("carousel/couple-waiting.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "66% 40%" }} />
        <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(10,6,6,0.35) 0%, rgba(10,6,6,0) 22%, rgba(10,6,6,0) 42%, rgba(10,6,6,0.82) 78%, rgba(10,6,6,0.9) 100%)" }} />
      </AbsoluteFill>
    }
  >
    <div style={{ position: "absolute", left: M, right: M, top: 870 }}>
      <Headline size={124} color="#fff" accentColor="#ff6b5e">{"Your couple is waiting.\nYour mind goes *blank.*"}</Headline>
    </div>
  </Slide>
);

/** A phone, struck through: the thing this replaces. */
const Phone: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg width={300} height={560} viewBox="0 0 300 560" style={style}>
    <rect x={12} y={12} width={276} height={536} rx={44} fill="#fff" stroke={INK} strokeWidth={6} />
    <rect x={112} y={30} width={76} height={14} rx={7} fill={INK} />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <rect key={i} x={36 + (i % 2) * 120} y={70 + Math.floor(i / 2) * 150} width={108} height={136} rx={10} fill="#e6e1d9" />
    ))}
    <line x1={-20} y1={560} x2={320} y2={0} stroke={RED} strokeWidth={14} strokeLinecap="round" />
  </svg>
);

const Pain: React.FC = () => (
  <Slide n={2} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 170 }}>
      <Headline size={118}>{"So you grab\nyour phone.\nScroll for poses.\n*In front of them.*"}</Headline>
      <Body style={{ marginTop: 34, maxWidth: 560 }}>They see you searching. The energy drops. The moment is gone.</Body>
    </div>
    <Phone style={{ position: "absolute", right: M + 10, top: 720, transform: "rotate(8deg)" }} />
  </Slide>
);

const Answer: React.FC = () => (
  <Slide n={3} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Headline size={108}>{"What if the next pose\nwas *already in\nyour camera?*"}</Headline>
    </div>
    <div style={{ position: "absolute", left: M, right: M, top: 530, height: 760, borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 60px rgba(40,20,10,0.2)" }}>
      <Img src={staticFile("photos/DSC08438.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%" }} />
    </div>
  </Slide>
);

const Anatomy: React.FC = () => {
  const cw = 470;
  const s = cw / CARD.w;
  const left = M;
  const top = 400;
  const parts = [
    { k: "The pose", v: "A real photo to copy", at: { x: 820, y: 700 }, y: 430 },
    { k: "Camera settings", v: "Vertical, eye level or lower", at: { x: 200, y: 700 }, y: 640 },
    { k: "The hack", v: "The detail that makes the shot", at: { x: 200, y: 1000 }, y: 850 },
    { k: "What to say", v: "The exact words for the couple", at: { x: 400, y: 1620 }, y: 1060 },
  ];
  const bx = 600;
  return (
    <Slide n={4} total={N}>
      <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
        <Headline size={108}>{"Everything you need,\non *one card.*"}</Headline>
      </div>
      <div style={{ position: "absolute", left, top, width: cw, height: CARD.h * s, borderRadius: 10, overflow: "hidden", boxShadow: "0 30px 60px rgba(40,20,10,0.22)" }}>
        <div style={{ transform: `scale(${s})`, transformOrigin: "0 0" }}>
          <PoseCard data={EDITORIAL} />
        </div>
      </div>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={W} height={1440}>
        {parts.map((p) => {
          const ax = left + p.at.x * s;
          const ay = top + p.at.y * s;
          return (
            <g key={p.k}>
              <line x1={ax} y1={ay} x2={bx - 14} y2={p.y + 22} stroke={RED} strokeWidth={3} />
              <circle cx={ax} cy={ay} r={9} fill={RED} stroke="#fff" strokeWidth={3} />
            </g>
          );
        })}
      </svg>
      {parts.map((p) => (
        <div key={p.k} style={{ position: "absolute", left: bx, right: M, top: p.y }}>
          <Label>{p.k}</Label>
          <div style={{ fontFamily: SANS, fontSize: 30, lineHeight: 1.3, color: INK, marginTop: 8 }}>{p.v}</div>
        </div>
      ))}
    </Slide>
  );
};

const How: React.FC = () => (
  <Slide n={5} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
      <Label>How it works</Label>
      <Headline size={112} style={{ marginTop: 18 }}>{"Three steps,\n*zero* phone."}</Headline>
    </div>
    <Steps style={{ position: "absolute", left: M, right: M, top: 560 }} />
    {/* Three real cards on the real camera: what step 3 looks like. */}
    <div style={{ position: "absolute", left: M, right: M, top: 1050, display: "flex", gap: 18 }}>
      {["DSC08435", "DSC08439", "DSC08442"].map((f) => (
        <div key={f} style={{ flex: 1, height: 190, borderRadius: 16, overflow: "hidden", boxShadow: "0 16px 34px rgba(40,20,10,0.16)" }}>
          <Img src={staticFile(`photos/${f}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%", transform: "scale(1.5)" }} />
        </div>
      ))}
    </div>
    <div style={{ position: "absolute", left: M, right: M, top: 1268, fontFamily: SANS, fontWeight: 600, fontSize: 30, color: INK }}>
      Sony · Canon · Nikon <span style={{ color: MUTED, fontWeight: 400 }}>· no account needed</span>
    </div>
  </Slide>
);

const Range: React.FC = () => (
  <Slide n={6} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
      <Headline size={118}>{"Every pose for\n*the whole day.*"}</Headline>
      <Body style={{ marginTop: 22 }}>From the first look to the first dance.</Body>
    </div>
    <Fan cardWidth={330} spread={122} style={{ position: "absolute", left: (W - 330) / 2, top: 520 }} />
    <Founders style={{ position: "absolute", left: M, top: 1190 }} />
  </Slide>
);

const Close: React.FC = () => (
  <Slide n={7} total={N}>
    <Cta />
  </Slide>
);

export const SLIDES_B: React.FC[] = [Hook, Pain, Answer, Anatomy, How, Range, Close];
