import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { SANS } from "../theme";
import { Body, CameraStrip, Card, CardAnatomy, Cta, Headline, INK, Label, M, MUTED, PAPER, RED, Slide, Steps } from "./kit";

// Concept C, problem solving for the whole wedding day: the photographer runs the day from a phone (Pinterest,
// a PDF timeline, the planner, a notes app); Shoot Cards puts poses, timeline, family groups and the shot list on
// the camera screen. 9 slides. The timeline, groups and shot-list cards are drawn by the site's own renderer
// (scripts/render-cards.mjs) with the /demo page's sample couple.
const N = 9;

/** A landscape Shoot Card (timeline, groups, shot list), as the camera shows it. */
const Wide: React.FC<{ src: string; width: number; rotate?: number; style?: React.CSSProperties }> = ({ src, width, rotate = 0, style }) => (
  <div style={{ width, height: (width * 2) / 3, borderRadius: 12, overflow: "hidden", boxShadow: "0 30px 60px rgba(40,20,10,0.2), 0 4px 12px rgba(40,20,10,0.1)", transform: `rotate(${rotate}deg)`, ...style }}>
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </div>
);

const Hook: React.FC = () => (
  <Slide
    n={1} total={N}
    bg={
      <AbsoluteFill>
        {/* the camera photo slid down a fifth, so the headline sits above it on paper */}
        <Img src={staticFile("photos/DSC08438.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "translateY(22%)" }} />
        <AbsoluteFill style={{ background: `linear-gradient(180deg, ${PAPER} 0%, ${PAPER} 30%, rgba(246,243,238,0) 44%, rgba(246,243,238,0) 84%, ${PAPER} 95%)` }} />
      </AbsoluteFill>
    }
  >
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Headline size={120}>{"Stop running\nthe wedding day\n*from your phone.*"}</Headline>
    </div>
    <div style={{ position: "absolute", left: M, top: 1220, background: "rgba(20,20,22,0.82)", color: "#fff", borderRadius: 18, padding: "18px 26px", fontFamily: SANS, fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em" }}>
      Poses · timeline · family groups · shot list. <span style={{ color: "#ff8a7e" }}>On your camera.</span>
    </div>
  </Slide>
);

const OldWay: React.FC = () => {
  const rows = [
    ["Pinterest", "for the next pose"],
    ["A PDF", "for the timeline"],
    ["The planner", "for “who’s next?”"],
    ["A notes app", "for the shot list"],
  ];
  return (
    <Slide n={2} total={N}>
      <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
        <Headline size={116}>{"The wedding day,\n*the old way:*"}</Headline>
      </div>
      <div style={{ position: "absolute", left: M, right: M, top: 500, display: "flex", flexDirection: "column", gap: 40 }}>
        {rows.map(([a, b]) => (
          <div key={a} style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 18, paddingBottom: 26, borderBottom: "1.5px solid rgba(20,20,22,0.12)" }}>
            <span style={{ position: "relative", fontFamily: SANS, fontWeight: 700, fontSize: 64, letterSpacing: "-0.03em", color: INK }}>
              {a}
              {/* struck through */}
              <span style={{ position: "absolute", left: -6, right: -6, top: "52%", height: 7, borderRadius: 4, background: RED, transform: "rotate(-2deg)" }} />
            </span>
            <span style={{ fontFamily: SANS, fontSize: 42, color: MUTED, letterSpacing: "-0.01em" }}>{b}</span>
          </div>
        ))}
      </div>
      <Body size={38} style={{ position: "absolute", left: M, right: M, top: 1200, color: INK }}>
        All on your phone. <b>In front of your couple.</b>
      </Body>
    </Slide>
  );
};

const AllOnCamera: React.FC = () => (
  <Slide n={3} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Headline size={112}>{"Now it’s all\n*on your camera screen.*"}</Headline>
    </div>
    <Card card="editorial" width={430} rotate={-3} style={{ position: "absolute", left: M, top: 500 }} />
    <div style={{ position: "absolute", left: 560, top: 450, display: "flex", flexDirection: "column", gap: 24 }}>
      <Wide src="cards/timeline.png" width={410} rotate={2} />
      <Wide src="cards/groups.png" width={410} rotate={-1.5} />
      <Wide src="cards/shotlist.png" width={410} rotate={1.5} />
    </div>
  </Slide>
);

const Poses: React.FC = () => (
  <Slide n={4} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 150 }}>
      <Label>Posing</Label>
      <Headline size={104} style={{ marginTop: 16 }}>{"Poses, with\n*the words to say.*"}</Headline>
    </div>
    <CardAnatomy top={480} />
  </Slide>
);

/** Timeline, family groups, shot list: one landscape card each, big, with what it replaces. */
const Feature: React.FC<{ n: number; label: string; title: string; src: string; line: string }> = ({ n, label, title, src, line }) => (
  <Slide n={n} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
      <Label>{label}</Label>
      <Headline size={112} style={{ marginTop: 16 }}>{title}</Headline>
    </div>
    <Wide src={src} width={936} rotate={-1.2} style={{ position: "absolute", left: M, top: 520 }} />
    <Body size={36} style={{ position: "absolute", left: M, right: M, top: 1180, color: INK }}>{line}</Body>
  </Slide>
);

const How: React.FC = () => (
  <Slide n={8} total={N}>
    <div style={{ position: "absolute", left: M, right: M, top: 160 }}>
      <Label>How it works</Label>
      <Headline size={112} style={{ marginTop: 18 }}>{"Three steps,\n*zero* phone."}</Headline>
    </div>
    <Steps style={{ position: "absolute", left: M, right: M, top: 560 }} />
    <CameraStrip top={1050} />
    <div style={{ position: "absolute", left: M, right: M, top: 1268, fontFamily: SANS, fontWeight: 600, fontSize: 30, color: INK }}>
      Sony · Canon · Nikon <span style={{ color: MUTED, fontWeight: 400 }}>· no account needed</span>
    </div>
  </Slide>
);

const Close: React.FC = () => (
  <Slide n={9} total={N}>
    <Cta />
  </Slide>
);

export const SLIDES_C: React.FC[] = [
  Hook,
  OldWay,
  AllOnCamera,
  Poses,
  () => <Feature n={5} label="Timeline" title={"The timeline,\n*one swipe away.*"} src="cards/timeline.png" line="No PDF. No checking your phone between the ceremony and the family photos." />,
  () => <Feature n={6} label="Family groups" title={"Family groups,\n*in order.*"} src="cards/groups.png" line="Call the next group by name, without asking the planner." />,
  () => <Feature n={7} label="Shot list" title={"The must-haves,\n*covered.*"} src="cards/shotlist.png" line="Every shot the couple asked for, a swipe away." />,
  How,
  Close,
];
